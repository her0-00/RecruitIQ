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
    const formData = await req.formData();
    const file = formData.get('photo') as File;
    const targetSize = parseInt((formData.get('targetSize') as string) || '300');
    
    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }
    
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }
    
    const requestId = crypto.randomUUID();
    tmpIn = path.join(os.tmpdir(), `photo_in_${requestId}.bin`);
    tmpOut = path.join(os.tmpdir(), `photo_out_${requestId}.json`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpIn, buffer);
    
    console.log(`[upload_photo] [${requestId}] Processing ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    
    const pythonScript = path.resolve(process.cwd(), '../backend/photo_processor_cli.py');
    const tmpInNorm = tmpIn.replace(/\\/g, '/');
    const tmpOutNorm = tmpOut.replace(/\\/g, '/');
    
    return new Promise<NextResponse>((resolve) => {
      const pyProcess = spawn('python', [pythonScript, tmpInNorm, tmpOutNorm, targetSize.toString()]);
      
      let errorData = '';
      pyProcess.stderr.on('data', (chunk) => { errorData += chunk.toString(); });
      
      pyProcess.on('error', (err) => {
        console.error(`[upload_photo] [${requestId}] spawn error:`, err);
        resolve(NextResponse.json({ error: 'Failed to start Python process', details: err.message }, { status: 500 }));
      });
      
      pyProcess.on('close', (code) => {
        try {
          if (code !== 0) {
            console.error(`[upload_photo] [${requestId}] Python exited with code`, code, '| stderr:', errorData);
            return resolve(NextResponse.json({ error: 'Photo processing failed', details: errorData }, { status: 500 }));
          }
          
          if (!fs.existsSync(tmpOut!)) {
            console.error(`[upload_photo] [${requestId}] Output file missing`);
            return resolve(NextResponse.json({ error: 'Output file missing' }, { status: 500 }));
          }
          
          const raw = fs.readFileSync(tmpOut!, 'utf8');
          const parsed = JSON.parse(raw);
          
          if (!parsed.success) {
            console.error(`[upload_photo] [${requestId}] Processing error:`, parsed.error);
            return resolve(NextResponse.json({ error: parsed.error || 'Processing failed' }, { status: 400 }));
          }
          
          console.log(`[upload_photo] [${requestId}] Success`);
          return resolve(NextResponse.json({ 
            success: true, 
            photo_base64: parsed.photo_base64,
            size: targetSize
          }));
          
        } catch (e: any) {
          console.error(`[upload_photo] [${requestId}] parse error:`, e.message);
          return resolve(NextResponse.json({ error: 'Failed to parse output' }, { status: 500 }));
        } finally {
          try { if (tmpIn && fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
          try { if (tmpOut && fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
        }
      });
    });
    
  } catch (error: any) {
    try { if (tmpIn && fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
    try { if (tmpOut && fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
    console.error('[upload_photo] Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
