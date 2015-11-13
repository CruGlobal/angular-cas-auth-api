(function(angular) {
    'use strict';

    // Register Angular Module
    angular.module('cas-auth-api', []);

})(window.angular);

(function(module) {
    'use strict';

    module.provider('casAuthApi', function() {

        // Configuration
        var _authenticationApiBaseUrl = 'https://example.com/',
          _endpoints = {
              'service': 'service',
              'token': 'token/new'
          },
          _ticketUrl = '',
          _maxAttempts = 3,
          _managedApis = [];

        /**
         * Set the base URL of the Authentication API.
         * Default: //localhost:3000/v1
         *
         * @param {string} url
         * @returns {self}
         */
        this.setAuthenticationApiBaseUrl = function(url) {
            // Normalize URL by stripping tailing slash
            _authenticationApiBaseUrl = endsWith('/', url) ? url.slice(0, -1) : url;
            return this;
        };

        /**
         * Sets the URL to fetch a new service ticket
         *
         * @param {string} url
         * @returns {self}
         */
        this.setTicketUrl = function(url) {
            _ticketUrl = url;
            return this;
        };

        /**
         * Add a url to the managed API list
         *
         * @param {string} url
         * @returns {*}
         */
        var addManagedApi = this.addManagedApi = function(url) {
            if (_managedApis.indexOf(url) === -1) {
                _managedApis.push(url);
            }
            return this;
        };

        function apiUrl(endpoint) {
            if (typeof endpoint === 'undefined' || !_endpoints.hasOwnProperty(endpoint)) {
                return _authenticationApiBaseUrl;
            }
            return _authenticationApiBaseUrl + '/' + _endpoints[endpoint];
        }

        // Factory
        this.$get = ["$injector", "$q", function($injector, $q) {
            var _accessToken,
              _deferredAuthentication;

            /**
             * Is the given url managed
             *
             * @param {string} url
             * @returns {boolean}
             */
            function isManagedApi(url) {
                for (var i = 0; i < _managedApis.length; i++) {
                    if (startsWith(_managedApis[i], url)) {
                        return true;
                    }
                }
                return false;
            }

            /**
             * $http Request Interceptor
             * Configures all managed $http requests
             *
             * @param {object} config
             * @see https://docs.angularjs.org/api/ng/service/$http#interceptors
             */
            function requestInterceptor(config) {
                // Ignore requests to authentication API
                if (config.url === apiUrl('service') || config.url === apiUrl('token')) {
                    return config;
                }

                // Only Handle URLs managed by the API
                if (isManagedApi(config.url)) {
                    // If we have a token, add it to the request
                    if (typeof _accessToken !== 'undefined') {
                        config.headers['Authorization'] = 'Bearer ' + _accessToken;
                    }

                    //Increase number of attempts
                    config.attempts = (typeof config.attempts === 'number') ? config.attempts + 1 : 1;
                }
                return config;
            }

            /**
             * $http Response Error Interceptor
             *
             * @param {object} response
             * @see https://docs.angularjs.org/api/ng/service/$http#interceptors
             */
            function responseErrorInterceptor(response) {
                if (response.status === 401 &&
                  isManagedApi(response.config.url) &&
                  response.config.attempts < _maxAttempts) {
                    // New promise for request
                    var deferred = $q.defer();

                    // Start authentication process if it isn't current running
                    if (typeof _deferredAuthentication !== 'object') {

                        // Create new deferred to handle authentication process
                        _deferredAuthentication = $q.defer();

                        // Fetch service URL
                        $injector
                          .get('$http')
                          .get(apiUrl('service'))
                          .then(function(serviceResponse) {
                              // Use wrapper ticketUrl to fetch ticket for given URL
                              $injector
                                .get('$http')
                                .get(_ticketUrl, {params: {service: serviceResponse.data.data.id}})
                                .then(function(ticketResponse) {
                                    //Exchange ticket for access_token
                                    $injector
                                      .get('$http')
                                      .get(apiUrl('token'), {params: {st: ticketResponse.data.data.id}})
                                      .then(function(tokenResponse) {
                                          // Set access token
                                          _accessToken = tokenResponse.data.data.id;

                                          // Resolve authentication deferred
                                          // this will cause all pending requests to retry
                                          _deferredAuthentication.resolve();
                                      }, function() {
                                          _deferredAuthentication.reject('Failed to fetch token.');
                                      });
                                }, function() {
                                    _deferredAuthentication.reject('Failed to fetch ticket.');
                                });
                          }, function() {
                              _deferredAuthentication.reject('Failed to fetch service.');
                          });
                    }

                    // Wait for authentication request before retrying
                    _deferredAuthentication.promise.then(function() {
                        // Authentication success - retry previous request
                        $injector.get('$http')(response.config).then(function(result) {
                            deferred.resolve(result);
                        }, function() {
                            // Retry request failed
                            deferred.reject();
                        });
                    }, function() {
                        // Authentication failed
                        deferred.reject();
                    });

                    return deferred.promise;
                }
                // Not handled by API, pass error through
                return $q.reject(response);
            }

            return {
                request: requestInterceptor,
                responseError: responseErrorInterceptor,
                addManagedApi: addManagedApi
            };
        }];

    });

    /**
     * The endsWith() method determines whether a string (haystack)
     * ends with the characters of another string (needle),
     * returning true or false as appropriate.
     *
     * @param {string} needle
     * @param {string} haystack
     * @param {number} [position]
     * @returns {boolean}
     */
    function endsWith(needle, haystack, position) {
        var subjectString = haystack.toString();
        if (angular.isNumber(position) || !isFinite(position) ||
          Math.floor(position) !== position ||
          position > subjectString.length) {
            position = subjectString.length;
        }
        position -= needle.length;
        var lastIndex = subjectString.indexOf(needle, position);
        return lastIndex !== -1 && lastIndex === position;
    }

    /**
     * The startsWith() method determines whether a string (haystack)
     * begins with the characters of another string (needle),
     * returning true or false as appropriate.
     *
     * @param {string} needle
     * @param {string} haystack
     * @param {number} [position]
     * @returns {boolean}
     */
    function startsWith(needle, haystack, position) {
        position = position || 0;
        return haystack.indexOf(needle, position) === position;
    }

})(angular.module('cas-auth-api'));

(function(module) {
    'use strict';

    // Configure Application to use casAuthApi to manage $http requests
    module.config(["$httpProvider", function($httpProvider) {

        // Allow casAuthenticatedApi to intercept and manipulate requests.
        // This will handle 401 unauthorized as well as adding an access_token
        // to all managed APIs
        $httpProvider.interceptors.push('casAuthApi');
    }]);

})(angular.module('cas-auth-api'));
