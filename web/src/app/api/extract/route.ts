import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    return new Promise<NextResponse>((resolve) => {
      const pythonScript = path.resolve(process.cwd(), '../backend/extractor.py');
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
          console.error('Python Extractor Error:', errorData);
          return resolve(NextResponse.json({ error: 'Python Extractor Failed', details: errorData }, { status: 500 }));
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
      
      // Write binary data to python stdin
      pyProcess.stdin.write(buffer);
      pyProcess.stdin.end();
    });

  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to extract PDF' }, { status: 500 });
  }
}
