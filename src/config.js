/*global angular */
/*global window */
(function (module, lscache) {
    'use strict';

    // Configure Application to use casAuthApi to manage $http requests
    module.config(function ($httpProvider) {

        // Allow casAuthenticatedApi to intercept and manipulate requests.
        // This will handle 401 unauthorized as well as adding an access_token
        // to all managed APIs
        $httpProvider.interceptors.push('casAuthApi');
    });

    module.run(function () {
        if (angular.isDefined(lscache)) {
            lscache.setBucket('cas-auth-api:');
        }
    });

}(angular.module('cas-auth-api'), window.lscache));
