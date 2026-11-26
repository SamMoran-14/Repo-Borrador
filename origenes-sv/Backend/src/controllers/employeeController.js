import { employeeSchema } from "../schemas/employee.schema.js";
import * as employeeService from "../services/employeeService.js";
import { parseOrRespond, requireId } from "../utils/validation.js";

export async function listEmployees(req, res) {
  const branchId = requireId(req.query.branchId, res, "sucursal");
  if (!branchId) return;
  res.json(await employeeService.listEmployees(branchId));
}

export async function createEmployee(req, res) {
  const data = parseOrRespond(employeeSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await employeeService.createEmployee(data));
}
