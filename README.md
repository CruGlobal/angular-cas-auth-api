# angular-cas-auth-api

AngularJS authentication module written for Cru API authentication systems.

Originally this module was written to support The Key (Cru CAS) before it had OAuth support. This has since been added
and is the recommended way of authenticating.
---

## Installation

Choose your preferred method:

* Bower: `bower install angular-cas-auth-api`
* NPM: `npm install --save angular-cas-auth-api`
* Download: [angular-cas-auth-api](https://raw.github.com/CruGlobal/angular-cas-auth-api/master/dist/cas-auth-api.min.js)

## Usage

###### 1. Request Client ID (optional)
If you are going to use The Key (Cru CAS) as your CAS authenticator you will need to get a Client ID.
send an email to [apps@cru.org](mailto:apps@cru.org?subject=New OAuth Client Request for The Key) with the subject **New OAuth Client Request for The Key**.


###### 1. Configure `casAuthApi`:

```js
angular.module('myApp', ['cas-auth-api'])
  .config(['casAuthApiProvider', function(casAuthApiProvider) {
    casAuthApiProvider.configure({
        requireAccessToken: true,
        cacheAccessToken: true, // If true you must include lscache #optional
        redirectUrl: 'http://localhost/', // URL to redirect to after OAuth Authentication #required
        clientId: '1234567890', // Client ID related to redirect URL #required
        oAuth: true // #required
    });
  }]);
```

###### 2. Catch `casAuthApi` errors and do something with them (optional):

```js
angular.module('myApp', ['cas-auth-api'])
  .run(['$rootScope', '$window', function($rootScope, $window) {
    $rootScope.$on('cas-auth-api:error', function(event, rejection) {
      if ('ERR_SERVICE' === rejection.code) {
        // retrieving service object failed
      }

      if ('ERR_TICKET' === rejection.code) {
        // retrieving ticket object failed
      }

      if ('ERR_TOKEN' === rejection.code) {
        // retrieving token object failed
      }

      // Redirect to `/login` with the `error_reason`.
      return $window.location.href = '/login?error_reason=' + rejection.message;
    });
  }]);
```

**NOTE**: An *event* `cas-auth-api:error` will be sent every time a `responseError` is emitted:

* `{ code: 'ERR_SERVICE', message: 'Failed to fetch service.'}`
* `{ code: 'ERR_TICKET', message: 'Failed to fetch ticket.'}`
* `{ code: 'ERR_TOKEN', message: 'Failed to fetch token.'}`

## API

#### CasAuthApiProvider

Configuration defaults:

```js
casAuthApiProvider.configure({
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
});
```

Catch and authenticate urls:

```js
/**
* Add a url to the managed API list
*
* @param {string|Array.<string>} url
* @returns {*}
*/
 casAuthApi.addManagedApi( 'https://ministry-view-api.cru.org/ministry_view/' );
```

## Contributing & Development

#### Contribute

Found a bug or want to suggest something? Take a look first on the current and closed [issues](https://github.com/CruGlobal/angular-cas-auth-api/issues). If it is something new, please [submit an issue](https://github.com/CruGlobal/angular-cas-auth-api/issues/new).

#### Develop

It will be awesome if you can help us evolve `angular-cas-auth-api`. Want to help?

1. [Fork it](https://github.com/CruGlobal/angular-cas-auth-api).
2. `npm install`.
3. Do your magic.
4. Run the tests: `gulp test`.
5. Build: `gulp build`
6. Create a [Pull Request](https://github.com/CruGlobal/angular-cas-auth-api/compare).