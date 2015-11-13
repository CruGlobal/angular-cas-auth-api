(function(module) {
    'use strict';

    // Configure Application to use casAuthApi to manage $http requests
    module.config(function($httpProvider) {

        // Allow casAuthenticatedApi to intercept and manipulate requests.
        // This will handle 401 unauthorized as well as adding an access_token
        // to all managed APIs
        $httpProvider.interceptors.push('casAuthApi');
    });

})(angular.module('cas-auth-api'));
