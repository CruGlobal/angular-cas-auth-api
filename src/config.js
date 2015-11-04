(function(module) {
    'use strict';

    // Configure Application to use casAuthenticatedApi to manage $http requests
    module.config(['$httpProvider', function ($httpProvider) {

        // Allow casAuthenticatedApi to intercept and manipulate requests.
        // This will handle 401 unauthorized as well as adding an access_token
        // to all managed APIs
        $httpProvider.interceptors.push('casAuthenticatedApi');
    }]);


})(angular.module('cas-authenticated-api'));
