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

      const { repo, ref = "main", path, start, end } = requestBody;

      // Validate required parameters
      if (!repo || !path) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing required parameters: repo and path' })
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

      let defaultBranch;
      try {
        const repoInfo = await client.repos.get({ owner, repo: name });
        defaultBranch = repoInfo.data.default_branch;
        console.log(`Repository default branch: ${defaultBranch}`);
      } catch (repoError) {
        console.error('Failed to get repository info:', repoError);
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: `Repository ${repo} not found or not accessible` })
        };
      }
      
      // Try with provided ref first, fall back to main if it fails
      let file;
      let actualRef = ref;
      
      const branchesToTry = [ref, defaultBranch, 'master', 'main'].filter((branch, index, arr) => 
        branch && arr.indexOf(branch) === index // Remove duplicates and null/undefined values
      );
      
      let lastError;
      for (const branch of branchesToTry) {
        try {
          console.log(`Trying to fetch file with ref: ${branch}`);
          file = await client.repos.getContent({ owner, repo: name, path, ref: branch });
          actualRef = branch;
          break;
        } catch (error) {
          console.log(`Failed with ref ${branch}:`, error.message);
          lastError = error;
          continue;
        }
      }

      if (!file) {
        console.error('Failed with all attempted branches:', branchesToTry);
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: `File not found at path ${path} in repo ${repo}`,
            originalRef: ref,
            triedBranches: branchesToTry,
            lastError: lastError?.message
          })
        };
      }

      if (!("content" in file.data)) {
        return { 
          statusCode: 404, 
          headers: corsHeaders,
          body: JSON.stringify({ error: "not a file" })
        };
      }
      
      const text = Buffer.from(file.data.content, "base64").toString("utf8");

      let snippet = text;
      if (start && end) {
        const lines = text.split("\n");
        snippet = lines.slice(start - 1, end).join("\n");
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          repo, 
          ref: actualRef, // Return the ref that actually worked
          path, 
          start, 
          end,
          snippet,
          url: `https://github.com/${repo}/blob/${actualRef}/${path}${start&&end?`#L${start}-L${end}`:""}`
        })
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