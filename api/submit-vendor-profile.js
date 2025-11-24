// api/submit-vendor-profile.js
module.exports = async function handler(req, res) {
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
  const organizationsDbId = process.env.NOTION_ORGANIZATIONS_DB_ID;

  if (!notionToken || !organizationsDbId) {
    console.error('❌ Missing environment variables!');
    res.status(500).json({ error: 'Missing configuration' });
    return;
  }

  console.log('🔄 Direct update mode - writing to Organizations DB only');

  try {
    const { token, formState, catalogueState } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    console.log('🚀 Creating vendor submission for token:', token);

    // Get organization info for booth number
    const orgResponse = await fetch(`https://api.notion.com/v1/databases/${organizationsDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          property: 'Token',
          rich_text: { equals: token }
        }
      })
    });

    const orgData = await orgResponse.json();
    if (orgData.results.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const org = orgData.results[0];
    const orgId = org.id;
    console.log('🏢 Found organization:', org.properties.Organization?.title?.[0]?.text?.content);
    console.log('🔄 Updating organization directly (no submission workflow)');

    // Build the update payload with all form data
    const updateData = {
      properties: {}
    };

    // Update organization fields directly
    if (formState.companyName) {
      updateData.properties["Organization"] = {
        title: [{ text: { content: formState.companyName } }]
      };
    }

    if (formState.website) {
      updateData.properties["Website"] = {
        url: formState.website
      };
    }

    if (formState.category) {
      updateData.properties["Primary Category"] = {
        select: { name: formState.category }
      };
    }

    if (formState.description) {
      updateData.properties["Company Description"] = {
        rich_text: [{ text: { content: formState.description } }]
      };
    }

    if (formState.highlightHeadline) {
      updateData.properties["Highlight Product Name"] = {
        rich_text: [{ text: { content: formState.highlightHeadline } }]
      };
    }

    if (formState.highlightDescription) {
      updateData.properties["Highlight Product Description"] = {
        rich_text: [{ text: { content: formState.highlightDescription } }]
      };
    }

    if (formState.highlightDeal) {
      updateData.properties["Highlight the Deal"] = {
        rich_text: [{ text: { content: formState.highlightDeal } }]
      };
    }

    if (formState.highlightImageUrl) {
      updateData.properties["Highlight Photo"] = {
        rich_text: [{ text: { content: formState.highlightImageUrl } }]
      };
    }

    if (catalogueState.uploadedUrl) {
      updateData.properties["Catalogue URL"] = {
        url: catalogueState.uploadedUrl
      };
    }

    // PATCH the organization record directly
    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${orgId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('❌ Notion update failed:', errorData);
      throw new Error(`Notion API error: ${errorData.message}`);
    }

    const updatedOrg = await updateResponse.json();
    console.log(`🎉 SUCCESS! Updated organization: ${updatedOrg.id}`);

    res.status(200).json({
      success: true,
      organizationId: updatedOrg.id,
      message: 'Vendor profile updated successfully!'
    });

  } catch (error) {
    console.error('💥 Error in vendor profile submission:', error);
    res.status(500).json({ 
      error: 'Failed to submit vendor profile', 
      details: error.message 
    });
  }
};
