import jwt from "jsonwebtoken";
import crypto from "crypto";

import {DynamoDBClient} from "@aws-sdk/client-dynamodb"
import {DynamoDBDocumentClient, PutCommand, QueryCommand} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const encoder = new TextEncoder();
const JWT_SECRET = encoder.encode(process.env.JWT_SECRET);
const IP_SESSIONS_TABLE = process.env.IP_SESSIONS_TABLE;
const JWT_ISSUER = process.env.JWT_ISSUER;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE;

const MAX_SESSIONS_PER_IP = 5;
const SESSION_TTL_SECONDS = 3 * 60 * 60; // 3 h
const JWT_TTL_SECONDS = 10 * 60 // 10 minutes

export const handler = async (event) => {
    console.log("Event:", JSON.stringify(event));

    try {
        // get IP
        const ip = event.requestContext.http.sourceIp;
        const now = Math.floor(Date.now() / 1000);

        const q = await ddb.send(new QueryCommand({
            TableName: IP_SESSIONS_TABLE,
            KeyConditionExpression: "#ip = :ip",
            ExpressionAttributeNames: {"#ip": "ip"},
            ExpressionAttributeValues: {":ip": ip},
            Select: "COUNT",
        }));

        const sessionCount = q.Count || 0;
        if (sessionCount >= MAX_SESSIONS_PER_IP) 
            {
            return {
                statusCode: 429,
                headers: {
                    "content-type": "application/json",
                    "cache-control": "no-store",
                },
                body: JSON.stringify({ error: "Too many sessions from this IP" }),
            }
        }

        const sessionId = crypto.randomUUID();
        const jti = crypto.randomUUID();
        const ttl = now + SESSION_TTL_SECONDS;

        await ddb.send(new PutCommand({
            TableName: IP_SESSIONS_TABLE,
            Item: {
                ip,
                sessionId,
                createdAt: now,
                ttl,
            },
        }));

        const token = jwt.sign(
            {
                sessionId,
                jti,
                scope: "chat",
            },
            JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: JWT_TTL_SECONDS,
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
            }
        );

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
                "cache-control": "no-store",
            },
            body: JSON.stringify({ token, sessionId }),
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
                "cache-control": "no-store",
            },
            body: JSON.stringify({ error: String(err?.message || err) }),
        }
    }
}