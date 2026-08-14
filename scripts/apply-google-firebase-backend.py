from pathlib import Path
p=Path('server.ts')
t=p.read_text(encoding='utf-8')
if "registerGoogleWorkspaceRoutes" not in t:
    t=t.replace("import { createServer as createViteServer } from 'vite';\n", "import { createServer as createViteServer } from 'vite';\nimport { googleWorkspaceConfigured, registerGoogleWorkspaceRoutes } from './server/googleWorkspaceRoutes.js';\n")
t=t.replace("const PORT = 3000;", "const PORT = Number(process.env.PORT || 3000);")
if "app.disable('x-powered-by')" not in t:
    t=t.replace("const app = express();\n", "const app = express();\napp.disable('x-powered-by');\n")
if "registerGoogleWorkspaceRoutes(app);" not in t:
    t=t.replace("app.use(express.json({ limit: '10mb' }));\n", "app.use(express.json({ limit: '10mb' }));\n\n// Google OAuth/Calendar/Meet routes are registered before Vite so callbacks are never swallowed by the SPA.\nregisterGoogleWorkspaceRoutes(app);\n")
t=t.replace("    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),\n", "    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),\n    firebaseProjectId: 'rl-connect-ed797',\n    firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),\n    googleWorkspaceConfigured: googleWorkspaceConfigured(),\n")
p.write_text(t,encoding='utf-8')

# environment documentation
p=Path('.env.example')
env=p.read_text(encoding='utf-8') if p.exists() else ''
for line in [
    'APP_URL=http://localhost:3000',
    'FIREBASE_SERVICE_ACCOUNT_JSON=',
    'GOOGLE_TOKEN_ENCRYPTION_KEY=',
    'GOOGLE_OAUTH_STATE_SECRET=',
]:
    key=line.split('=',1)[0]
    if key not in env: env += ('\n' if env and not env.endswith('\n') else '') + line + '\n'
p.write_text(env,encoding='utf-8')
print('Firebase Google backend patch applied.')
