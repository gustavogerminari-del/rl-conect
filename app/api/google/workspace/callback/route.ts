import { handleGoogleWorkspaceCallback } from '../_shared';

export async function GET(request: Request) {
  return handleGoogleWorkspaceCallback(request);
}
