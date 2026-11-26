import { listActiveBranches } from "../services/branchService.js";

export async function listBranches(_req, res) {
  res.json(await listActiveBranches());
}
