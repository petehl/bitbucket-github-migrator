export const getRepo = async (owner, slug, auth) => {
    const { user, appPassword } = auth;
    const basicAuth = Buffer.from(`${user}:${appPassword}`).toString('base64');

    const headers = {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }; 

    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${slug}`, { method: 'GET', headers });
    if (!response.ok) {
        throw new Error(await response.text());
    }

    const repo = await response.json()
    return repo;
}

export const renameRepo = async (owner, slug, auth, undo = false) => {
    const { user, appPassword } = auth;
    const basicAuth = Buffer.from(`${user}:${appPassword}`).toString('base64');

    const headers = {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }; 
    const rslug = undo ? `_gh_${slug}` : slug;
    const rename = !undo ? `_gh_${slug}` : slug;


    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${rslug}`, { method: 'PUT', headers, body: JSON.stringify({name: rename}) });
    if (!response.ok) {
        throw new Error(await response.text());
    }

    const repo = await response.json()
    return repo;
}