import * as Joi from 'joi';

/** Validation des variables d'environnement au démarrage : l'API refuse de démarrer si une valeur manque. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  API_PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().default(30),
  INTERNAL_API_TOKEN: Joi.string().min(32).required(),
  S3_ENDPOINT: Joi.string().uri().required(),
  S3_PUBLIC_ENDPOINT: Joi.string().uri().optional(),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET: Joi.string().required(),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(true),
  LIVEKIT_API_KEY: Joi.string().required(),
  LIVEKIT_API_SECRET: Joi.string().min(32).required(),
  LIVEKIT_URL: Joi.string().uri().required(),
  LIVEKIT_WS_URL: Joi.string().required(),
  LIVEKIT_PUBLIC_WS_URL: Joi.string().required(),
  FIREBASE_SERVICE_ACCOUNT_JSON: Joi.string().allow('').optional(),
  DEFAULT_SOURCE_LANGUAGE: Joi.string().default('fr'),
  DEFAULT_TARGET_LANGUAGES: Joi.string().default('en'),
}).unknown(true);
