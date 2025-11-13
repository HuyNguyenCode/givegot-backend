// controllers/matchController.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * GET /match?user_id=...
 * trả về danh sách candidates (1-way match: candidates give what current user want)
 */
export async function getMatches(req, res) {
  try {
    const uid = req.query.user_id;
    if (!uid) return res.status(400).json({ error: "user_id required" });

    // 1) want & give ids của user hiện tại
    const { data: wantRows, error: err1 } = await supabase
      .from("user_skills")
      .select("skill_id")
      .eq("user_id", uid)
      .eq("type", "want");

    if (err1) throw err1;
    const wantIds = (wantRows || []).map((r) => r.skill_id);
    if (wantIds.length === 0) return res.json({ matches: [] });

    // 2) tìm user khác có skill type = 'give' trong wantIds
    const { data: candidates, error: err2 } = await supabase
      .from("user_skills")
      .select("user_id, skill_id")
      .in("skill_id", wantIds)
      .eq("type", "give");

    if (err2) throw err2;

    const userIds = [
      ...new Set((candidates || []).map((c) => c.user_id)),
    ].filter((id) => id !== uid);
    if (userIds.length === 0) return res.json({ matches: [] });

    // 3) lấy profile và map skill names
    const { data: profiles, error: err3 } = await supabase
      .from("profiles")
      .select("user_id, full_name, contact_link, avatar_url")
      .in("user_id", userIds);

    if (err3) throw err3;

    const { data: skills, error: err4 } = await supabase
      .from("skills")
      .select("id,name");
    if (err4) throw err4;
    const skillMap = Object.fromEntries(
      (skills || []).map((s) => [s.id, s.name])
    );

    // 4) build result: aggregate matched skills per user
    const result = (profiles || []).map((p) => {
      const matchedSkillIds = (candidates || [])
        .filter((c) => c.user_id === p.user_id)
        .map((c) => c.skill_id);
      const matchedSkillNames = matchedSkillIds
        .map((id) => skillMap[id])
        .filter(Boolean);
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        contact_link: p.contact_link,
        avatar_url: p.avatar_url || null,
        matched_skills: [...new Set(matchedSkillNames)],
      };
    });

    // sort by number of matched skills desc
    result.sort((a, b) => b.matched_skills.length - a.matched_skills.length);

    return res.json({ matches: result, count: result.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || err });
  }
}

/**
 * POST /matches
 * body: { user_a: "...", user_b: "...", matched_skills: ["x","y"] }
 */
export async function createMatch(req, res) {
  try {
    const { user_a, user_b, matched_skills } = req.body;
    if (!user_a || !user_b)
      return res.status(400).json({ error: "user_a & user_b required" });

    // ensure deterministic ordering to avoid duplicate opposite records
    const [ua, ub] = user_a < user_b ? [user_a, user_b] : [user_b, user_a];

    // insert
    const payload = {
      user_a: ua,
      user_b: ub,
      matched_skills: matched_skills || [],
    };

    const { data, error } = await supabase
      .from("matches")
      .insert(payload)
      .select()
      .single();
    if (error) {
      // handle unique violation gracefully
      return res.status(500).json({ error: error.message || error });
    }

    return res.json({ match: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || err });
  }
}

// controllers/matchController.js (thêm các hàm sau)

export async function getUserMatches(req, res) {
  try {
    const uid = req.query.user_id;
    if (!uid) return res.status(400).json({ error: "user_id required" });

    // lấy tất cả match mà user là user_a hoặc user_b
    const { data, error } = await supabase
      .from("matches")
      .select(
        "id, user_a, user_b, matched_skills, status, reason, created_at, accepted_at"
      )
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.json({ matches: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || err });
  }
}

export async function acceptMatch(req, res) {
  try {
    const matchId = req.params.id;
    if (!matchId) return res.status(400).json({ error: "match id required" });

    // update: status + accepted_at
    const { data, error } = await supabase
      .from("matches")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", matchId)
      .select()
      .single();

    if (error) throw error;

    // optional: return updated match and trigger notification (email/telegram) here
    return res.json({ match: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || err });
  }
}

export async function rejectMatch(req, res) {
  try {
    const matchId = req.params.id;
    const { reason } = req.body || {};
    if (!matchId) return res.status(400).json({ error: "match id required" });

    const { data, error } = await supabase
      .from("matches")
      .update({ status: "rejected", reason: reason || null })
      .eq("id", matchId)
      .select()
      .single();

    if (error) throw error;
    return res.json({ match: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || err });
  }
}
