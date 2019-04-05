import { Handler, Context, Callback } from 'aws-lambda';
// import { Context, Callback } from 'aws-lambda';
import * as config from 'config';
import * as jwt from 'jsonwebtoken';
import * as uuid from 'uuid/v1';
import * as https from 'https';
import * as URL from 'url';
import * as I from './interfaces';

/**
 * Lambda Entrypoint
 */
const handler: Handler = async (event: any, context: Context, callback: Callback): Promise<void> => {
// const handler: any = async (event: any, context?: Context, callback?: Callback): Promise<void> => {
  const { email } = event;
  try {
    const customerId = await getCustomerId(email);
    if (!customerId) {
      const errorMessage = 'BigCommerce User Not Found';
      const response = buildLambdaResponse({ errorMessage });

      return callback(null, response);
      // console.log(response);
    }
    const jwtToken = generateJwtToken(customerId);
    const response = buildLambdaResponse({ jwtToken });

    return callback(null, response);
    // console.log(response);
  } catch (error) {
    console.log(`Error: Error retrieving bigcommerce customer ID for ${email}`);

    return callback(error);
  }
};

/**
 * Returns the bigcommerce customer id, or 0 if customer not found.
 */
async function getCustomerId(email: string): Promise<number> {
  const requestOptions = buildHttpRequestOptions('GET', `customers?email=${encodeURIComponent(email)}`);
  try {
    const response = await makeHttpRequest(requestOptions);
    if (response.statusCode && (response.statusCode < 200 || response.statusCode > 299)) {
      console.log(response);
      throw new Error('BigCommerce Request Error'); // @todo better error handling
    } else {
      if (response.data) {
        const data = JSON.parse(response.data);
        const customerId = data[0].id;

        return customerId;
      }

      return 0;
    }
  } catch (error) {
    throw new Error(error);
  }
}

/**
 * @todo move this to bc service
 */
function buildHttpRequestOptions(method: string, resource: string): any {
  const { storeHash, clientId, accessToken, apiHostname } = config.get('BigCommerce');
  const url = URL.parse(`${apiHostname}/stores/${storeHash}/v2/${resource}`);
  const requestOptions = {
    method,
    hostname: url.host,
    path: url.path,
    headers: {
      Accept: 'application/json',
      Connection: 'keep-alive',
      'Content-Type': 'application/json',
      'X-Auth-Client': clientId,
      'X-Auth-Token': accessToken,
    },
  };

  return requestOptions;
}

/**
 * Makes a HTTP request.
 * @todo move this to http service
 */
function makeHttpRequest(options: any, data?: any): Promise<I.HttpResponse> {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = '';

      // Concatenate Response Data
      response.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received
      response.on('end', () => {
        const { statusCode, headers } = response;
        resolve({ data, statusCode, headers });
      });
    });

    request.on('error', (error) => { // @todo implement custom error type
      reject(error);
    });
    request.end(data);
  });
}

/**
 * Generates a JWT SSO token for a given customer.
 */
function generateJwtToken(customerId: number): string {
  const { clientId, storeHash, clientSecret } = config.get('BigCommerce');

  const payload = {
    iss: clientId,
    iat: Math.floor((new Date).getTime() / 1000),
    jti: uuid(),
    operation: 'customer_login',
    store_hash: storeHash,
    customer_id: customerId,
    redirect_to: '/cart.php?action=buy&sku=p1',
  };
  const token = jwt.sign(payload, clientSecret);

  return token;
}

/**
 * Builds the lambda json response string
 */
function buildLambdaResponse(data: any): string {
  const { jwtToken, errorMessage } = data;
  const response = {
    token: jwtToken,
    error: errorMessage,
  };

  return JSON.stringify(response);
}

// handler({email: 'rob+t-03220355@bettercommerce.com'});

export { handler };
