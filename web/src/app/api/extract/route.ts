import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    return new Promise<NextResponse>((resolve) => {
      // In Docker: /app/web (cwd) -> /app/backend
      const pythonScript = path.resolve(process.cwd(), '..', 'backend', 'extractor.py');
      console.log('[extract] Python script path:', pythonScript);
      const pyProcess = spawn('python', [pythonScript]);
      
      let outputData = '';
      let errorData = '';
      
      pyProcess.stdout.on('data', (chunk) => {
        outputData += chunk.toString();
      });
      
      pyProcess.stderr.on('data', (chunk) => {
        errorData += chunk.toString();
      });
      
      pyProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('[extract] Python exit code:', code);
          console.error('[extract] Python stderr:', errorData);
          console.error('[extract] Python stdout:', outputData);
          return resolve(NextResponse.json({ error: 'Python Extractor Failed', details: errorData || 'No error output' }, { status: 500 }));
        }
        
        try {
          const parsed = JSON.parse(outputData);
          if (!parsed.success) {
             return resolve(NextResponse.json({ error: parsed.error || 'Extractor Error' }, { status: 500 }));
          }
          return resolve(NextResponse.json({ text: parsed.text }));
        } catch (e: any) {
          console.error("JSON parse error from python output:", outputData);
          return resolve(NextResponse.json({ error: 'Failed to parse python output', details: outputData }, { status: 500 }));
        }
      });
      
      pyProcess.on('error', (err) => {
        console.error('Python Process Error:', err);
        return resolve(NextResponse.json({ error: 'Failed to spawn Python process', details: err.message }, { status: 500 }));
      });
      
      pyProcess.stdin.on('error', (err: any) => {
        if (err.code !== 'EPIPE') {
          console.error('Python stdin error:', err);
        }
      });
      
      // Write binary data to python stdin
      try {
        pyProcess.stdin.write(buffer);
        pyProcess.stdin.end();
      } catch (err: any) {
        console.error('Failed to write to Python stdin:', err);
        return resolve(NextResponse.json({ error: 'Failed to send data to Python', details: err.message }, { status: 500 }));
      }
    });

  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to extract PDF' }, { status: 500 });
  }
}
