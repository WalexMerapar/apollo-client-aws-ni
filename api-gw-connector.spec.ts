import gql from 'graphql-tag';

import * as mocha from 'mocha';
import * as chai from 'chai';


import {
  AwsApiGwClient,
  AwsApiGwNetworkInterface,
} from './api-gw-connector';

const assert = chai.expect;

describe('AWS API GW network interface', () => {
  const simpleQueryWithNoVars = gql`
    query people {
      allPeople(first: 1) {
        people {
          name
        }
      }
    }
  `;

  const simpleResult = {
    data: {
      allPeople: {
        people: [
          {
            name: 'Luke Skywalker',
          },
        ],
      },
    },
  };

  describe('making a request', () => {
    let clientSet = true;

    const awsApiGwClient: AwsApiGwClient = {
      isAuthenticated() {
        return clientSet;
      },
      authenticationExpired() {
        clientSet = false;
      },
      graphqlPost(param, body, extra) {
        assert(JSON.stringify(body)).to.equal(
          '{"query":"query people {\\n  allPeople(first: 1) {\\n    people {\\n      name\\n    }\\n  }\\n}\\n","variables":{},"debugName":"People query"}'
        );
        return Promise.resolve({
          data: simpleResult,
          status: 200,
          statusText: 'OK',
        });
      },
    };

    const awsApiGwClientError: AwsApiGwClient = {
      isAuthenticated() {
        return clientSet;
      },
      authenticationExpired() {
        clientSet = false;
      },
      graphqlPost(param, body, extra) {
        assert(JSON.stringify(body)).to.equal(
          '{"query":"query people {\\n  allPeople(first: 1) {\\n    people {\\n      name\\n    }\\n  }\\n}\\n","variables":{},"debugName":"People query"}',
        );
        return Promise.resolve({
          data: 'Unauthorized',
          status: 401,
          statusText: 'Unauthorized',
        });
      },
    };

    const networkInterface: AwsApiGwNetworkInterface = new AwsApiGwNetworkInterface(
      awsApiGwClient,
    );
    const networkInterfaceError: AwsApiGwNetworkInterface = new AwsApiGwNetworkInterface(
      awsApiGwClientError,
    );

    const simpleRequest = {
      query: simpleQueryWithNoVars,
      variables: {},
      debugName: 'People query',
    };

    it('should fetch remote data', () => {
      networkInterface.query(simpleRequest).then( res => {
        return assert(res).to.equal(simpleResult);
      })
    });

    it('should throw an error when client AWS API GW not ready', () => {
      clientSet = false;

      return networkInterface.query(simpleRequest).catch(err => {
        assert(err.message).to.equal(
          'AWS API GW client not ready/authenticated !',
        );
      });
    });

    it('should call authenticationExpired() when authentication is wrong/expired', () => {
      clientSet = true;

      return networkInterfaceError.query(simpleRequest).catch(err => {
        assert(err.response).to.be;
        assert(err.message).to.equal(
          'Network request failed with status 401 - "Unauthorized"',
        );
        assert(clientSet).to.equal(false);
      });
    });
  });
});
