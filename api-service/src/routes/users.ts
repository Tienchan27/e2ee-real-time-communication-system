import { Router } from "express";
import { pool } from "../db.js";
import { fail, ok } from "../http.js";
import { authRequired } from "../middlewares/auth.js";
import { isUuid, parseLimit } from "../validation.js";

const router = Router();

router.get("/search", authRequired, async (req, res) => {
  const q = req.query.q;
  const limit = parseLimit(req.query.limit, 20, 50);
  const cursor = req.query.cursor;

  if (typeof q !== "string" || q.trim().length < 1 || q.length > 100 || limit === null) {
    return fail(res, 400, "VALIDATION_FAILED", "Invalid search query");
  }
  if (cursor !== undefined && !isUuid(cursor)) {
    return fail(res, 400, "VALIDATION_FAILED", "Invalid cursor");
  }

  const result = await pool.query<{
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  }>(
    `
      SELECT id, username, display_name, avatar_url
      FROM users
      WHERE id <> $1
        AND (
          username ILIKE $2 || '%'
          OR lower(email) = lower($3)
        )
        AND ($4::uuid IS NULL OR id > $4)
      ORDER BY username ASC
      LIMIT $5
    `,
    [req.auth!.userId, q.trim(), q.trim(), cursor ?? null, limit + 1],
  );

  const hasMore = result.rows.length > limit;
  const rows = result.rows.slice(0, limit);

  return ok(res, {
    results: rows.map((row) => ({
      userId: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url ?? null,
    })),
    nextCursor: hasMore ? rows.at(-1)?.id ?? null : null,
  });
});

export const usersRouter = router;
