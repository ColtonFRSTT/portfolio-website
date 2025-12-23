import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const WS_CONNECTION_TABLE = process.env.CONNECTIONS_TABLE;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const JWT_ISSUER = process.env.JWT_ISSUER;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE;

export const handler = async (event) => {

  const connectionId = event.requestContext.connectionId;
  const now = Math.floor(Date.now() / 1000);
  const ip = event.requestContext.identity.sourceIp;

  const token = event.queryStringParameters?.token;
  if (!token) {
    return {
      statusCode: 400,
      headers: {  
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ error: "Missing token" }),
    };
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch (e) {
    return {
      statusCode: 401,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ error: "Invalid token" }),
    }
  };

  const sessionId = decodedToken.sessionId;
  const jti = decodedToken.jti;
  const jwtExp = decodedToken.exp;

  if (!sessionId || !jti || !jwtExp) {
    return {
      statusCode: 401,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ error: "Invalid token payload" }),
    }
  }

  await ddb.send( new PutCommand({
    TableName: WS_CONNECTION_TABLE,
    Item: {
      connectionId,
      sessionId,
      jti,
      ip,
      createdAt: now,
      jwtExp,
      ttl: jwtExp,
    },
  }));

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify({ success: true }),
  };
};
