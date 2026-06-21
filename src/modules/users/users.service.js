// src/modules/users/users.service.js
import * as usersRepository from './users.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { hashPassword } from '../../utils/bcrypt.js';
import { validatePasswordPolicy } from '../../utils/password-validator.js';
import {
  ConflictError,
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../../utils/errors.js';
import { logger } from '../../logger/index.js';