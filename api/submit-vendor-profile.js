// api/submit-vendor-profile.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const notionToken = process.env.NOTION_TOKEN;
  const submissionsDbId = process.env.NOTION_SUBMISSIONS_DB_ID || '209a69bf0cfd80afa65dcf0575c9224f';
  const organizationsDbId = process.env.NOTION_ORGANIZATIONS_DB_ID;
  
  if (!notionToken || !submissionsDbId || !organizationsDbId) {
    console.error('❌ Missing environment variables!');
    res.status(500).json({ error: 'Missing configuration' });
    return;
  }

  // 🧪 DEBUG LOGGING STARTS HERE (after line 35)
  console.log('🧪 Testing Notion connection...');
  console.log('🔍 Token starts with:', notionToken?.substring(0, 10));
  console.log('🔍 Token length:', notionToken?.length);
  console.log('🔍 Submissions DB ID:', submissionsDbId);
  console.log('🔍 Organizations DB ID:', organizationsDbId);

  // Try a simple query to test the connection
  try {
    console.log('🧪 Attempting to fetch submissions database metadata...');
    const testResponse = await fetch(`https://api.notion.com/v1/databases/${submissionsDbId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    console.log('🧪 Test response status:', testResponse.status);
    
    if (!testResponse.ok) {
      const errorData = await testResponse.json();
      console.error('🧪 Test failed with error:', JSON.stringify(errorData, null, 2));
    } else {
      console.log('✅ Test passed - database is accessible!');
    }
  } catch (testError) {
    console.error('🧪 Test error:', testError.message);
  }
  // 🧪 DEBUG LOGGING ENDS HERE

  try {
    const { token, formState, catalogueState } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    console.log('🚀 Creating vendor submission for token:', token);

    // ... rest of your existing code stays the same ...
