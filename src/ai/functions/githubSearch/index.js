import { Octokit } from "@octokit/rest";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async function gh() {
  const sm = new SecretsManagerClient({});
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: "KoltBotGitKey" }));
  const { KOLTBOTGITKEY } = JSON.parse(SecretString);
  return new Octokit({ auth: KOLTBOTGITKEY });
}

export const handler = async (event) => {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  console.log('Event received:', JSON.stringify(event, null, 2));
  
  // Handle OPTIONS preflight request
  if (event.requestContext.http.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Handle POST request
  if (event.requestContext.http.method === 'POST') {
    console.log('Handling POST request');
    
    try {
      // Parse request body
      let requestBody = {};
      if (event.body) {
        try {
          requestBody = JSON.parse(event.body);
          console.log('Parsed request body:', requestBody);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid JSON in request body' })
          };
        }
      } else {
        console.error('No body in POST request');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Request body is required for POST requests' })
        };
      }

      const { repo, q, type = "code" } = requestBody;

      // Validate required parameters
      if (!repo || !q) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing required parameters: repo and q' })
        };
      }

      const [owner, name] = repo.split("/");
      if (!owner || !name) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid repo format. Expected "owner/name"' })
        };
      }

      const client = await gh();

      if (type === "code") {
        const res = await client.search.code({ 
          q: `${q} repo:${owner}/${name}`, 
          per_page: 10 
        });
        
        // Map to minimal payload Claude can cite
        const results = res.data.items.map(i => ({
          repo: `${owner}/${name}`,
          path: i.path,
          ref: i.sha,
          url: i.html_url
        }));

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(results)
        };
      }

      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Unsupported search type: ${type}` })
      };
      
    } catch (error) {
      console.error('Handler error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Internal server error',
          message: error.message 
        })
      };
    }
  }

  // Handle unsupported methods
  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};