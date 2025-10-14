// api/get-organization-contacts.js - Get all contacts for an organization
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: `Method ${req.method} not allowed, expected GET` });
    return;
  }
  
  const token = req.query.token;
  
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }
  
  // Use environment variables
  const notionToken = process.env.NOTION_TOKEN;
  const organizationsDbId = process.env.NOTION_ORGANIZATIONS_DB_ID;
  const contactsDbId = process.env.NOTION_CONTACTS_DB_ID;
  const tagSystemDbId = process.env.NOTION_TAG_SYSTEM_DB_ID || '1f9a69bf0cfd8034b919f51b7c4f2c67';
  
  // Safety check
  if (!notionToken || !organizationsDbId || !contactsDbId) {
    console.error('❌ Missing environment variables!');
    res.status(500).json({ error: 'Missing configuration' });
    return;
  }
  
  try {
    console.log('🔍 Looking up organization for token:', token);
    
    // Step 1: Get the organization from the token
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
          rich_text: {
            equals: token
          }
        }
      })
    });
    
    if (!orgResponse.ok) {
      throw new Error(`Organization lookup failed: ${orgResponse.status}`);
    }
    
    const orgData = await orgResponse.json();
    
    if (orgData.results.length === 0) {
      res.status(404).json({ error: 'Organization not found for token' });
      return;
    }
    
    const org = orgData.results[0];
    const organizationName = org.properties.Organization?.title?.[0]?.text?.content || '';
    const organizationId = org.id;
    
    console.log('🏢 Found organization:', organizationName);
    console.log('🔍 Organization ID for relation:', organizationId);
    
    // Step 2: Get BOTH the "Primary Contact" AND "26 Conference Exhibitor" tag IDs
    console.log('🏷️ Looking up required tags...');
    let primaryContactTagId = null;
    let conferenceExhibitorTagId = null;
    
    try {
      // Get Primary Contact tag
      const primaryTagResponse = await fetch(`https://api.notion.com/v1/databases/${tagSystemDbId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          filter: {
            property: 'Name',
            title: { equals: 'Primary Contact' }
          }
        })
      });
      
      if (primaryTagResponse.ok) {
        const tagData = await primaryTagResponse.json();
        if (tagData.results.length > 0) {
          primaryContactTagId = tagData.results[0].id;
          console.log('✅ Found Primary Contact tag ID:', primaryContactTagId);
        }
      }

      // Get 26 Conference Exhibitor tag
      const conferenceTagResponse = await fetch(`https://api.notion.com/v1/databases/${tagSystemDbId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          filter: {
            property: 'Name',
            title: { equals: '26 Conference Exhibitor' }
          }
        })
      });
      
      if (conferenceTagResponse.ok) {
        const tagData = await conferenceTagResponse.json();
        if (tagData.results.length > 0) {
          conferenceExhibitorTagId = tagData.results[0].id;
          console.log('✅ Found 26 Conference Exhibitor tag ID:', conferenceExhibitorTagId);
        }
      }
    } catch (error) {
      console.error('💥 Error finding tags:', error);
    }
    
    // Step 3: Get contacts where Organization relation = this org ID
    console.log('👥 Fetching contacts for organization...');
    
    const contactsResponse = await fetch(`https://api.notion.com/v1/databases/${contactsDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          property: 'Organization',
          relation: {
            contains: organizationId
          }
        }
      })
    });
    
    if (!contactsResponse.ok) {
      throw new Error(`Contacts lookup failed: ${contactsResponse.status}`);
    }
    
    const contactsData = await contactsResponse.json();
    console.log(`📋 Found ${contactsData.results.length} contacts for ${organizationName}`);
    
    // Step 4: Format the contacts data and check for tags
    const contacts = contactsData.results.map(contact => {
      const props = contact.properties;
      
      // Check if this contact has the Primary Contact tag
      let isPrimaryContact = false;
      let isAttending = false;
      
      if (props['Personal Tag']?.relation) {
        const tagIds = props['Personal Tag'].relation.map(tag => tag.id);
        
        // Check for Primary Contact tag
        if (primaryContactTagId && tagIds.includes(primaryContactTagId)) {
          isPrimaryContact = true;
          console.log(`👑 Found primary contact: ${props.Name?.title?.[0]?.text?.content}`);
        }
        
        // Check for Conference Exhibitor tag (means they're already attending)
        if (conferenceExhibitorTagId && tagIds.includes(conferenceExhibitorTagId)) {
          isAttending = true;
          console.log(`✅ Found attending contact: ${props.Name?.title?.[0]?.text?.content}`);
        }
      }
      
      return {
        id: contact.id,
        name: props.Name?.title?.[0]?.text?.content || 'Unknown Name',
        firstName: props['First Name']?.rich_text?.[0]?.text?.content || '',
        workEmail: props['Work Email']?.email || '',
        workPhone: props['Work Phone Number']?.phone_number || '',
        roleTitle: props['Role/Title']?.rich_text?.[0]?.text?.content || '',
        dietaryRestrictions: props['Dietary Restrictions']?.rich_text?.[0]?.text?.content || '',
        contactType: props['Contact Type']?.select?.name || '',
        tags: props.Tags?.multi_select?.map(tag => tag.name) || [],
        notes: props.Notes?.rich_text?.[0]?.text?.content || '',
        isAttending: isAttending,
        isPrimaryContact: isPrimaryContact
      };
    });
    
    // Filter out contacts without basic info
    const validContacts = contacts.filter(contact => 
      contact.name && contact.name !== 'Unknown Name' && 
      (contact.workEmail || contact.workPhone)
    );
    
    // Count for debugging
    const primaryContactsCount = validContacts.filter(c => c.isPrimaryContact).length;
    const attendingCount = validContacts.filter(c => c.isAttending).length;
    
    console.log(`👑 Found ${primaryContactsCount} primary contacts`);
    console.log(`✅ Found ${attendingCount} already attending contacts`);
    console.log(`✅ Returning ${validContacts.length} valid contacts`);
    
    res.status(200).json({
      success: true,
      organizationName: organizationName,
      contacts: validContacts,
      totalFound: contactsData.results.length,
      validContacts: validContacts.length,
      primaryContactsFound: primaryContactsCount,
      attendingContactsFound: attendingCount
    });
    
  } catch (error) {
    console.error('💥 Error fetching organization contacts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contacts', 
      details: error.message 
    });
  }
};
