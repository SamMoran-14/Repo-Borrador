import { payrollSchema } from "../schemas/payroll.schema.js";
import * as payrollService from "../services/payrollService.js";
import { parseOrRespond } from "../utils/validation.js";

export async function listPayroll(_req, res) {
  res.json(await payrollService.listPayrollRuns());
}

export async function createPayroll(req, res) {
  const data = parseOrRespond(payrollSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await payrollService.createPayroll(data, Number(req.user.sub)));
}
