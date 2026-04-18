const API_KEY = 'AIzaSyD1R49nSBhZ2a3krwpRRKn7qRjF86BzvsE';

async function listModels() {
  try {
    console.log('🔍 Fetching available Google AI models...\n');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Available models:\n');
    
    data.models.forEach(model => {
      const supportsGenerate = model.supportedGenerationMethods?.includes('generateContent');
      if (supportsGenerate) {
        console.log(`✓ ${model.name.replace('models/', '')}`);
        console.log(`  Display: ${model.displayName}`);
        console.log(`  Description: ${model.description}`);
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listModels();
