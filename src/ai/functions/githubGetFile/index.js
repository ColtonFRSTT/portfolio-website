import { Octokit } from "@octokit/rest";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async function gh() {
  const sm = new SecretsManagerClient({});
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: "KoltBotGitKey" }));
  const { KOLTBOTGITKEY } = JSON.parse(SecretString);
  return new Octokit({ auth: KOLTBOTGITKEY });
}

export const handler = async (event) => {
  const { repo, ref = "main", path, start, end } = JSON.parse(event.body);
  const [owner, name] = repo.split("/");
  const client = await gh();
  const file = await client.repos.getContent({ owner, repo: name, path, ref });

  if (!("content" in file.data)) return { statusCode: 404, body: "not a file" };
  const text = Buffer.from(file.data.content, "base64").toString("utf8");

  let snippet = text;
  if (start && end) {
    const lines = text.split("\n");
    snippet = lines.slice(start - 1, end).join("\n");
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      repo, ref, path, start, end,
      snippet,
      url: `https://github.com/${repo}/blob/${ref}/${path}${start&&end?`#L${start}-L${end}`:""}`
    })
  };
};