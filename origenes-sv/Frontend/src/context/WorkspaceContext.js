import { createContext, useContext } from "react";

// Contexto compartido con la sucursal y el usuario activos.
// Vive en su propio archivo para que las páginas no tengan que importar App.jsx.
export const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);
