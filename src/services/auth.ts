import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { CorsOptions } from "cors";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const ALLOWED_AUTH_MODES = new Set(["none", "api-key", "jwt", "api-key-or-jwt"]);

const authMode = ALLOWED_AUTH_MODES.has(config.security.authMode)
  ? config.security.authMode
  : "none";

const hasMatchingApiKey = (provided: string): boolean =>
  config.security.apiKeys.length > 0 && config.security.apiKeys.includes(provided);

const getBearerToken = (authorizationHeader?: string): string | undefined => {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return token.trim();
};

const verifyJwt = (token: string): boolean => {
  if (!config.security.jwtSecret) {
    return false;
  }

  try {
    jwt.verify(token, config.security.jwtSecret, {
      issuer: config.security.jwtIssuer || undefined,
      audience: config.security.jwtAudience || undefined
    });
    return true;
  } catch {
    return false;
  }
};

const sendUnauthorized = (res: Response): void => {
  res.status(401).json({ error: "Unauthorized" });
};

export const requireApiAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (authMode === "none") {
    return next();
  }

  const apiKey = (req.header("x-api-key") ?? "").trim();
  const bearer = getBearerToken(req.header("authorization"));

  if (authMode === "api-key") {
    if (apiKey && hasMatchingApiKey(apiKey)) {
      return next();
    }
    return sendUnauthorized(res);
  }

  if (authMode === "jwt") {
    if (bearer && verifyJwt(bearer)) {
      return next();
    }
    return sendUnauthorized(res);
  }

  if ((apiKey && hasMatchingApiKey(apiKey)) || (bearer && verifyJwt(bearer))) {
    return next();
  }

  return sendUnauthorized(res);
};

export const apiCorsOptions: CorsOptions = {
  origin(origin, callback) {
    if (config.security.corsAllowedOrigins.length === 0) {
      callback(null, true);
      return;
    }

    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.toLowerCase();
    const isAllowed = config.security.corsAllowedOrigins.includes(normalizedOrigin);
    callback(isAllowed ? null : new Error("Not allowed by CORS"), isAllowed);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
};
