(function(module, lscache) {
    'use strict';

    module.provider('casAuthApi', function() {

        // Configuration
        var _authenticationApiBaseUrl = 'https://example.com/',
          _endpoints = {
              'service': 'service',
              'token': 'token/new'
          },
          _ticketUrl = '',
          _errorCallback,
          _maxAttempts = 3,
          _requireAccessToken = false,
          _cacheAccessToken = false,
          _cacheExpiresMinutes = 25,
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
         * @param {string|Array.<string>} url
         * @returns {*}
         */
        var addManagedApi = this.addManagedApi = function(url) {
            var urls = angular.isString(url) ? [url] : url;
            angular.forEach(urls, function(value) {
                if (this.indexOf(value) === -1) {
                    this.push(value);
                }
            }, _managedApis);
            return this;
        };

        /**
         * Require an access token on all managed API requests. Default false
         * Enabling this feature will cause the API to fetch an access token rather
         * than waiting for a 401 Unauthorized to occur.
         *
         * @param {bool} require
         * @returns {self}
         */
        this.setRequireAccessToken = function(require) {
            _requireAccessToken = !!require;
            return this;
        };

        /**
         * Cache Access Token between page reloads
         *
         * @param {bool} cache
         * @returns {self}
         */
        this.setCacheAccessToken = function(cache) {
            _cacheAccessToken = angular.isUndefined(lscache) ? false : !!cache;
            return this;
        };

        this.setErrorCallback = function(cb) {
            _errorCallback = angular.isFunction(cb) ? cb : undefined;
            return this;
        };

        /**
         * Returns an full api URL for the given named endpoint
         *
         * @private
         * @param {string} endpoint
         * @returns {*}
         */
        function apiUrl(endpoint) {
            if (typeof endpoint === 'undefined' || !_endpoints.hasOwnProperty(endpoint)) {
                return _authenticationApiBaseUrl;
            }
            return _authenticationApiBaseUrl + '/' + _endpoints[endpoint];
        }

        // Factory
        this.$get = function($injector, $q) {
            var _accessToken,
              _deferredAuthentication;

            /**
             * Is the given url managed
             *
             * @private
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
             * Begins the authentication process
             */
            function beginAuthentication() {
                // Requests already deferred, bail.
                if (angular.isObject(_deferredAuthentication)) {
                    return;
                }

                // Create new deferred to handle authentication process
                _deferredAuthentication = $q.defer();

                // invalidate access token and cache
                _accessToken = undefined;
                if (_cacheAccessToken) {
                    lscache.remove('access_token');
                }

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
                                  // Set access token, we do not cache here.
                                  // Cache is handled after successful request.
                                  _accessToken = tokenResponse.data.data.id;

                                  // Resolve authentication deferred
                                  // this will cause all pending requests to retry
                                  _deferredAuthentication.resolve();
                              }, function() {
                                  _deferredAuthentication.reject('Failed to fetch token.');
                              });
                        }, function() {
                            if (angular.isFunction(_errorCallback)) {
                                _errorCallback({code: 'ERR_TICKET', message: 'Failed to fetch ticket.'});
                            }
                            _deferredAuthentication.reject('Failed to fetch ticket.');
                        });
                  }, function() {
                      _deferredAuthentication.reject('Failed to fetch service.');
                  });
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
                    // If missing access token and we are caching it, see if we have one
                    if (angular.isUndefined(_accessToken) && _cacheAccessToken) {
                        var token = lscache.get('access_token');
                        if (token !== null) {
                            _accessToken = token;
                        }
                    }

                    //Increase number of attempts
                    config.attempts = (typeof config.attempts === 'number') ? config.attempts + 1 : 1;

                    // If we require a token and don't have one, or api is currently authenticating
                    // defer the request until authentication completes
                    if ((_requireAccessToken && angular.isUndefined(_accessToken)) ||
                      angular.isObject(_deferredAuthentication)) {
                        return deferRequest(config);
                    }
                    else {
                        // If we have a token, add it to the request
                        if (angular.isDefined(_accessToken)) {
                            config.headers['Authorization'] = 'Bearer ' + _accessToken;
                        }
                    }
                }
                return config;
            }

            /**
             * Defers request config until authentication completes
             *
             * @param {object} config
             * @returns {Promise.<Object>}
             */
            function deferRequest(config) {
                var deferred = $q.defer();
                beginAuthentication();

                _deferredAuthentication.promise.then(function() {
                    // Add new token to the header
                    config.headers['Authorization'] = 'Bearer ' + _accessToken;
                    deferred.resolve(config);
                }, function() {
                    deferred.reject();
                });

                return deferred.promise;
            }

            function responseInterceptor(response) {
                if (isManagedApi(response.config.url)) {
                    //Cache the access token after successful managed request
                    if (angular.isDefined(_accessToken) && _cacheAccessToken) {
                        lscache.set('access_token', _accessToken, _cacheExpiresMinutes);
                    }
                }
                return response;
            }

            /**
             * $http Response Error Interceptor
             *
             * @param {object} response
             * @see https://docs.angularjs.org/api/ng/service/$http#interceptors
             */
            function responseErrorInterceptor(response) {
                if (isManagedApi(response.config.url) &&
                  wwwAuthenticateCAS(response) &&
                  response.config.attempts < _maxAttempts) {
                    // New promise for request
                    var deferred = $q.defer();
                    beginAuthentication();

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

            function wwwAuthenticateCAS(response) {
                var header = response.headers('WWW-Authenticate');
                return response.status === 401 && header && startsWith('CAS', header);
            }

            return {
                request: requestInterceptor,
                response: responseInterceptor,
                responseError: responseErrorInterceptor,
                addManagedApi: addManagedApi
            };
        };
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

})(angular.module('cas-auth-api'), window.lscache);
