/*global angular */
/*global window */
(function (module, lscache) {
    'use strict';

    module.provider('casAuthApi', function () {

        // Configuration
        var defaults = {
            endpoints: {
                'service': 'service',
                'token': 'token/new'
            },
            ticketUrl: '',
            maxAttempts: 3,
            requireAccessToken: false,
            cacheAccessToken: false,
            cacheExpiresMinutes: 25,
            managedApis: [],
            casBaseUrl: 'https://thekey.me',
            casLoginPath: '/cas/login',
            casTicketPath: '/cas/api/oauth/ticket',
            oAuth: false,
            authenticationApiBaseUrl: 'https://auth-api.cru.org/v1'
        }, oAuthRequiredKeys = [
            'redirectUrl',
            'clientId'
        ], config, addManagedApi;

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
            var subjectString = haystack.toString(), lastIndex;
            if (angular.isNumber(position) || !isFinite(position) ||
                    Math.floor(position) !== position ||
                    position > subjectString.length) {
                position = subjectString.length;
            }
            position -= needle.length;
            lastIndex = subjectString.indexOf(needle, position);
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

        this.configure = function (params) {
            // Can only be configured once.
            if (config) {
                throw new Error('Already configured.');
            }

            // Check if is an `object`.
            if (!(params instanceof Object)) {
                throw new TypeError('Invalid argument: `config` must be an `Object`.');
            }

            // Extend default configuration.
            config = angular.extend({}, defaults, params);

            // Check if all required keys are set.
            if (config.oAuth === true) {
                angular.forEach(oAuthRequiredKeys, function (key) {
                    if (!config[key]) {
                        throw new Error('Missing parameter: ' + key + '.');
                    }
                });
            }

            // Remove `casBaseUrl` trailing slash.
            if (endsWith('/', config.casBaseUrl)) {
                config.casBaseUrl = config.casBaseUrl.slice(0, -1);
            }

            // Remove `authenticationApiBaseUrl` trailing slash.
            if (endsWith('/', config.authenticationApiBaseUrl)) {
                config.authenticationApiBaseUrl = config.authenticationApiBaseUrl.slice(0, -1);
            }

            // Add `casLoginPath` facing slash.
            if (startsWith('/', config.casLoginPath) === false) {
                config.casLoginPath = '/' + config.casLoginPath;
            }

            // Add `casTicketPath` facing slash.
            if (startsWith('/', config.casLoginPath) === false) {
                config.casTicketPath = '/' + config.casTicketPath;
            }

            return config;
        };

        /**
        * Set the base URL of the Authentication API.
        * Default: https://example.com/
        *
        * @param {string} url
        * @returns {self}
        */
        this.setAuthenticationApiBaseUrl = function (url) {
            // Normalize URL by stripping tailing slash
            config.authenticationApiBaseUrl = endsWith('/', url) ? url.slice(0, -1) : url;
            return this;
        };

        /**
        * Sets the URL to fetch a new service ticket
        *
        * @param {string} url
        * @returns {self}
        */
        this.setTicketUrl = function (url) {
            config.ticketUrl = url;
            return this;
        };

        /**
        * Add a url to the managed API list
        *
        * @param {string|Array.<string>} url
        * @returns {*}
        */
        addManagedApi = this.addManagedApi = function (url) {
            var urls = angular.isString(url) ? [url] : url;
            angular.forEach(urls, function (value) {
                if (this.indexOf(value) === -1) {
                    this.push(value);
                }
            }, config.managedApis);
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
        this.setRequireAccessToken = function (require) {
            config.requireAccessToken = !!require;
            return this;
        };

        /**
        * Cache Access Token between page reloads
        *
        * @param {bool} cache
        * @returns {self}
        */
        this.setCacheAccessToken = function (cache) {
            config.cacheAccessToken = angular.isUndefined(lscache) ? false : !!cache;
            return this;
        };

        this.setErrorCallback = function (cb) {
            config.errorCallback = angular.isFunction(cb) ? cb : undefined;
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
            if (endpoint === undefined || !config.endpoints.hasOwnProperty(endpoint)) {
                return config.authenticationApiBaseUrl;
            }
            return config.authenticationApiBaseUrl + '/' + config.endpoints[endpoint];
        }

        // Factory
        this.$get = function ($injector, $q, $rootScope) {

            /**
            * Is the given url managed
            *
            * @private
            * @param {string} url
            * @returns {boolean}
            */
            function isManagedApi(url) {
                var i;
                for (i = 0; i < config.managedApis.length; i += 1) {
                    if (startsWith(config.managedApis[i], url)) {
                        return true;
                    }
                }
                return false;
            }

            function getAccessTokenFromHash() {
                var queryString = $injector.get('$window').location.hash.substr(1),
                    queries = queryString.split("&"),
                    params = {},
                    i,
                    pair;
                for (i = 0; i < queries.length; i += 1) {
                    if (queries[i] !== '') {
                        pair = queries[i].split('=');
                        params[pair[0]] = pair[1];
                    }
                }
                return params;
            }

            function standardAuthenticationError(code, message) {
                $rootScope.$emit('cas-auth-api:error', { code: code, message: message });
                if (angular.isFunction(config.errorCallback)) {
                    config.errorCallback({
                        code: code,
                        message: message
                    });
                } else {
                    config.deferredAuthentication.reject(message);
                }
            }

            function tokenResponder(tokenResponse) {
                // Set access token, we do not cache here.
                // Cache is handled after successful request.
                config.accessToken = tokenResponse.data.data.id;
                // Resolve authentication deferred
                // this will cause all pending requests to retry
                config.deferredAuthentication.resolve();
            }

            function tokenResponderError() {
                standardAuthenticationError('ERR_TOKEN', 'Failed to fetch token.');
            }

            function ticketResponder(ticketResponse) {
                var st = (config.oAuth === true) ? ticketResponse.data.ticket : ticketResponse.data.data.id;
                //Exchange ticket for access_token
                $injector
                    .get('$http')
                    .get(apiUrl('token'), {
                        params: {
                            st: st
                        }
                    })
                    .then(tokenResponder, tokenResponderError);
            }

            function ticketResponderError() {
                standardAuthenticationError('ERR_TICKET', 'Failed to fetch ticket.');
            }

            function serviceResponder(serviceResponse) {
                var url, httpConfig;
                if (config.oAuth === true) {
                    // Use casTicketPath to fetch ticket for given URL
                    url = config.casBaseUrl + config.casTicketPath;
                    httpConfig = {
                        params: {
                            service: serviceResponse.data.data.id
                        },
                        headers: {
                            'Authorization': 'Bearer ' + getAccessTokenFromHash().access_token
                        }
                    };
                } else {
                    // Use wrapper ticketUrl to fetch ticket for given URL
                    url = config.ticketUrl;
                    httpConfig = {
                        params: {
                            service: serviceResponse.data.data.id
                        }
                    };
                }
                $injector.get('$http').get(url, httpConfig).then(ticketResponder, ticketResponderError);
            }

            function serviceResponderError() {
                standardAuthenticationError('ERR_SERVICE', 'Failed to fetch service.');
            }

            /**
            * Begins the authentication process
            */
            function beginAuthentication() {
                // Requests already deferred, bail.
                if (angular.isObject(config.deferredAuthentication)) {
                    return;
                }

                // Create new deferred to handle authentication process
                config.deferredAuthentication = $q.defer();

                // invalidate access token and cache
                config.accessToken = undefined;
                if (config.cacheAccessToken && angular.isDefined(lscache)) {
                    lscache.remove('access_token');
                }

                if (config.oAuth === true && getAccessTokenFromHash().access_token === undefined) {
                    $injector.get('$window').location.href =
                        config.casBaseUrl + config.casLoginPath +
                        '?response_type=token&client_id=' +
                        config.clientId +
                        '&redirect_uri=' +
                        config.redirectUrl +
                        '&scope=fullticket';
                }

                // Fetch service URL
                $injector.get('$http').get(apiUrl('service')).then(serviceResponder, serviceResponderError);
            }

            /**
            * Defers request config until authentication completes
            *
            * @param {object} request
            * @returns {Promise.<Object>}
            */
            function deferRequest(request) {
                var deferred = $q.defer();
                beginAuthentication();

                config.deferredAuthentication.promise.then(function () {
                    // Add new token to the header
                    request.headers.Authorization = 'Bearer ' + config.accessToken;
                    deferred.resolve(request);
                }, function () {
                    deferred.reject();
                });

                return deferred.promise;
            }

            /**
            * $http Request Interceptor
            * Configures all managed $http requests
            *
            * @param {object} response
            * @see https://docs.angularjs.org/api/ng/service/$http#interceptors
            */
            function requestInterceptor(response) {
                // Ignore requests to authentication API
                if (response.url === apiUrl('service') || response.url === apiUrl('token')) {
                    return response;
                }

                // Only Handle URLs managed by the API
                if (isManagedApi(response.url)) {
                    // If missing access token and we are caching it, see if we have one
                    if (angular.isUndefined(config.accessToken) && config.cacheAccessToken) {
                        var token;
                        if (angular.isDefined(lscache)) {
                            token = lscache.get('access_token');
                        }
                        if (token !== null) {
                            config.accessToken = token;
                        }
                    }

                    //Increase number of attempts
                    response.attempts = (typeof response.attempts === 'number') ? response.attempts + 1 : 1;

                    // If we require a token and don't have one, or api is currently authenticating
                    // defer the request until authentication completes
                    if ((config.requireAccessToken && angular.isUndefined(config.accessToken)) ||
                            angular.isObject(config.deferredAuthentication)) {
                        return deferRequest(response);
                    }
                    // If we have a token, add it to the request
                    if (angular.isDefined(config.accessToken)) {
                        response.headers.Authorization = 'Bearer ' + config.accessToken;
                    }
                }
                return response;
            }

            function responseInterceptor(response) {
                if (isManagedApi(response.config.url)) {
                    //Cache the access token after successful managed request
                    if (angular.isDefined(config.accessToken) && config.cacheAccessToken && angular.isDefined(lscache)) {
                        lscache.set('access_token', config.accessToken, config.cacheExpiresMinutes);
                    }
                }
                return response;
            }

            function wwwAuthenticateCAS(response) {
                var header = response.headers('WWW-Authenticate');
                return response.status === 401 && header && startsWith('CAS', header);
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
                        response.config.attempts < config.maxAttempts) {
                    // New promise for request
                    var deferred = $q.defer();
                    beginAuthentication();

                    // Wait for authentication request before retrying
                    config.deferredAuthentication.promise.then(function () {
                        // Authentication success - retry previous request
                        $injector.get('$http')(response.config).then(function (result) {
                            deferred.resolve(result);
                        }, function () {
                            // Retry request failed
                            deferred.reject();
                        });
                    }, function () {
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
                response: responseInterceptor,
                responseError: responseErrorInterceptor,
                addManagedApi: addManagedApi
            };
        };
    });
}(angular.module('cas-auth-api'), window.lscache));
