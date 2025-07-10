import {
    WorkspacesData
} from './workspaceManager';

export function sortWorkspaces(workspacesData: WorkspacesData): WorkspacesData {
    const sortedWorkspaces = Object.entries(workspacesData.workspaces)
        .sort(([, a], [, b]) => {
            const mtimeA = a.mtime ? new Date(a.mtime).getTime() : 0;
            const mtimeB = b.mtime ? new Date(b.mtime).getTime() : 0;
            return mtimeB - mtimeA; // Sort by most recently modified first
        })
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {} as Record<string, any>);

    return {
        ...workspacesData,
        workspaces: sortedWorkspaces,
    };
}

import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };