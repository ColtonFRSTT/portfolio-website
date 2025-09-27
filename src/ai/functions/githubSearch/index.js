import { Octokit } from "@octokit/rest";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async function gh() {
  const sm = new SecretsManagerClient({});
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: "KoltBotGitKey" }));
  const { KOLTBOTGITKEY } = JSON.parse(SecretString);
  return new Octokit({ auth: KOLTBOTGITKEY });
}

export const handler = async (event) => {
  const { repo, q, type = "code" } = JSON.parse(event.body);
  const [owner, name] = repo.split("/");
  const client = await gh();

  if (type === "code") {
    const res = await client.search.code({ q: `${q} repo:${owner}/${name}` , per_page: 10 });
    // map to minimal payload Claude can cite
    return {
      statusCode: 200,
      body: JSON.stringify(res.data.items.map(i => ({
        repo: `${owner}/${name}`,
        path: i.path,
        ref: i.sha,
        url: i.html_url
      })))
    };
  }
};