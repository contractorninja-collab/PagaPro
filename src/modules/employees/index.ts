/** Punonjësit module — public exports for barrels / tests */
export {
  createEmployeeAction,
  updateEmployeeAction,
  archiveEmployeeAction,
  terminateEmployeeAction,
  deleteEmployeeAction,
  getEmployeeDetailAction,
} from "@/modules/employees/actions/employee-actions";
export type { EmployeeActionResult } from "@/modules/employees/actions/employee-actions";
export * from "@/modules/employees/types";
export {
  getEmployeesPageData,
  getEmployeeById,
  createEmployee,
  updateEmployee,
} from "@/modules/employees/services/employee-service";
