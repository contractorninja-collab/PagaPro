export {
  createDepartmentAction,
  deleteDepartmentAction,
  loadDepartmentOptionsAction,
  loadDepartmentsAction,
  renameDepartmentAction,
} from "./actions/department-actions";
export type { DepartmentWithEmployeeCountDto } from "./services/department-service";
export {
  createDepartment,
  deleteDepartment,
  listDepartmentsForCompany,
  listDepartmentsWithEmployeeCounts,
  renameDepartment,
} from "./services/department-service";
