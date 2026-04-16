import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let tmpIn: string | null = null;
  let tmpOut: string | null = null;
  try {
    const data = await req.json();

    // Use UUIDs to avoid filename collisions on highly concurrent deployments like Render
    const requestId = crypto.randomUUID();
    tmpIn  = path.join(os.tmpdir(), `cv_in_${requestId}.json`);
    tmpOut = path.join(os.tmpdir(), `cv_out_${requestId}.json`);
    
    fs.writeFileSync(tmpIn, JSON.stringify(data), 'utf8');
    console.log(`[generate_cv] [${requestId}] payload size:`, JSON.stringify(data).length, 'theme:', data.theme);

    // Normalize paths
    const pythonScript = path.resolve(process.cwd(), '../backend/worker.py');
    const tmpInNorm  = tmpIn!.replace(/\\/g, '/');
    const tmpOutNorm = tmpOut!.replace(/\\/g, '/');

    return new Promise<NextResponse>((resolve) => {
      // Try 'python3' as fallback if 'python' fails in some Linux environments
      const pyProcess = spawn('python', [pythonScript, tmpInNorm, tmpOutNorm]);

      let errorData = '';
      pyProcess.stderr.on('data', (chunk) => { errorData += chunk.toString(); });

      pyProcess.on('error', (err) => {
        console.error(`[generate_cv] [${requestId}] spawn error:`, err);
        resolve(NextResponse.json({ error: 'Failed to start Python process', details: err.message }, { status: 500 }));
      });

      pyProcess.on('close', (code) => {
        try {
          if (code !== 0) {
            let traceback = '';
            try { 
              if (fs.existsSync(tmpOut!)) {
                const r = JSON.parse(fs.readFileSync(tmpOut!, 'utf8')); 
                traceback = r.traceback || r.error || ''; 
              }
            } catch {}
            console.error(`[generate_cv] [${requestId}] Python exited with code`, code, '| stderr:', errorData, '| traceback:', traceback);
            return resolve(NextResponse.json({ error: 'Python Generator Failed', details: errorData || traceback }, { status: 500 }));
          }

          if (!fs.existsSync(tmpOut!)) {
            console.error(`[generate_cv] [${requestId}] Output file missing`);
            return resolve(NextResponse.json({ error: 'Python output file missing' }, { status: 500 }));
          }

          const raw = fs.readFileSync(tmpOut!, 'utf8');
          const parsed = JSON.parse(raw);
          if (!parsed.success) {
            console.error(`[generate_cv] [${requestId}] Python logic error:`, parsed.error, '\n', parsed.traceback);
            return resolve(NextResponse.json({ error: parsed.error || 'Generator Error', traceback: parsed.traceback }, { status: 500 }));
          }
          return resolve(NextResponse.json({ success: true, pdf_base64: parsed.pdf_base64 }));
        } catch (e: any) {
          console.error(`[generate_cv] [${requestId}] parse error:`, e.message, '| stderr:', errorData);
          return resolve(NextResponse.json({ error: 'Failed to parse python output' }, { status: 500 }));
        } finally {
          try { if (tmpIn && fs.existsSync(tmpIn))  fs.unlinkSync(tmpIn);  } catch {}
          try { if (tmpOut && fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
        }
      });
    });

  } catch (error: any) {
    try { if (tmpIn && fs.existsSync(tmpIn))  fs.unlinkSync(tmpIn);  } catch {}
    try { if (tmpOut && fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
    console.error('Generate CV Error:', error);
    return NextResponse.json({ error: error.message || 'Generation Failed' }, { status: 500 });
  }
}
