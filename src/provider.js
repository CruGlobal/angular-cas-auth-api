(function (module) {
    'use strict';

    module.provider('casAuthenticatedApi', function () {

        // Configuration
        var _authenticationApiBaseUrl = 'https://example.com/',
            _endpoints = {
                'service': 'service',
                'token': 'tokens/new'
            },
            _ticketUrl = '',
            _maxAttempts = 3,
            _managedApis = [];

        /**
         * Set the base URL of the Authentication API.
         * Default: //localhost:3000/v1
         *
         * @param url
         * @returns {*}
         */
        this.setAuthenticationApiBaseUrl = function (url) {
            // Normalize URL by stripping tailing slash
            _authenticationApiBaseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
            return this;
        };

        /**
         *
         * @param url
         */
        this.setTicketUrl = function (url) {
            _ticketUrl = url;
            return this;
        };

        /**
         * Add a url to the managed API list
         *
         * @param url
         * @returns {*}
         */
        var addManagedApi = this.addManagedApi = function (url) {
            if (_managedApis.indexOf(url) === -1)
                _managedApis.push(url);
            return this;
        };

        function apiUrl(endpoint) {
            if (typeof endpoint === 'undefined' || !_endpoints.hasOwnProperty(endpoint)) return _authenticationApiBaseUrl;
            return _authenticationApiBaseUrl + '/' + _endpoints[endpoint];
        }

        // Factory
        this.$get = function ($injector, $q) {
            var _accessToken,
                _deferredAuthentication;

            /**
             * Is the given url managed
             *
             * @param url
             * @returns {boolean}
             */
            function isManagedApi(url) {
                for (var i = 0; i < _managedApis.length; i++) {
                    if (url.startsWith(_managedApis[i]))
                        return true;
                }
                return false;
            }

            /**
             * $http Request Interceptor
             * Configures all managed $http requests
             *
             * @param config
             * @see https://docs.angularjs.org/api/ng/service/$http#interceptors
             */
            function requestInterceptor(config) {
                // Ignore requests to authentication API
                if (config.url === apiUrl('service') || config.url === apiUrl('token')) return config;

                // Only Handle URLs managed by the API
                if (isManagedApi(config.url)) {
                    // If we have a token, add it to the request
                    if (typeof _accessToken !== 'undefined')
                        config.headers['Authorization'] = 'Bearer ' + _accessToken;

                    //Increase number of attempts
                    config.attempts = ( typeof config.attempts === 'number' ) ? config.attempts + 1 : 1;
                }
                return config;
            }

            /**
             * $http Response Error Interceptor
             *
             * @param response
             * @see https://docs.angularjs.org/api/ng/service/$http#interceptors
             */
            function responseErrorInterceptor(response) {
                if (response.status === 401 && isManagedApi(response.config.url) && response.config.attempts < _maxAttempts) {
                    // New promise for request
                    var deferred = $q.defer();

                    // Start authentication process if it isn't current running
                    if (typeof _deferredAuthentication !== 'object') {

                        // Create new deferred to handle authentication process
                        _deferredAuthentication = $q.defer();

                        // Fetch service URL
                        $injector.get('$http').get(apiUrl('service')).then(function (serviceResponse) {
                            // Use wrapper ticketUrl to fetch ticket for given URL
                            $injector.get('$http').get(_ticketUrl, {params: {service: serviceResponse.data.service}}).then(function (ticketResponse) {
                                //Exchange ticket for access_token
                                $injector.get('$http').get(apiUrl('token'), {params: {st: ticketResponse.data.service_ticket}}).then(function (tokenResponse) {
                                    // Set access token
                                    _accessToken = tokenResponse.data.data.id;

                                    // Resolve authentication deferred, this will cause all pending requests to retry
                                    _deferredAuthentication.resolve();
                                }, function () {
                                    _deferredAuthentication.reject('Failed to fetch token.');
                                });
                            }, function () {
                                _deferredAuthentication.reject('Failed to fetch ticket.');
                            });
                        }, function () {
                            _deferredAuthentication.reject('Failed to fetch service.');
                        });
                    }

                    // Wait for authentication request before retrying
                    _deferredAuthentication.promise.then(function () {
                        // Authentication success - retry previous request
                        $injector.get('$http')(response.config).then(function (result) {
                            deferred.resolve(result);
                        }, function () {
                            // Retry request failed
                            deferred.reject();
                        });
                    }, function (reason) {
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
        };

    });

})(angular.module('cas-authenticated-api'));
