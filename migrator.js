import fs from 'fs';
import { exec, execSync } from 'child_process';
import { getRepo, renameRepo } from './bb-api.js';
import 'dotenv/config';


// console.log(fs.readdirSync('.'));

const reposList = fs.readFileSync('./repos.csv', 'utf8').split('\n');

const checkEnvVar = (varName, fallback) => {
    // console.log(varName, fallback);
    if (process.env[varName] === undefined) {
        if (fallback === undefined) {
            throw new Error(`${varName} env var is not defined`)
        } else {
            return fallback;
        }
    }
    return process.env[varName];
}

const repos = reposList.reduce((all, repoLine) => {
    const [name, newName, archive, deprecateBitbucket, additionalTopics, additionalAdmins ] = repoLine.split(',');
    const repo = {
        name,
        newGHName: newName,
        archive: archive?.startsWith('Y') || archive?.startsWith('y'),
        additionalTopics: additionalTopics? additionalTopics?.split('+') : [],
        additionalAdmins: additionalAdmins ? additionalAdmins.split('+') : [],
        deprecateBitbucket: deprecateBitbucket !== 'N',
    };
    if (repo.name && !repo?.name?.startsWith('+')) {
        all.push(repo);
    }
    return all;
}, []);

console.log(repos);

const bitbucketOrg = checkEnvVar('BITBUCKET_ORG');
const bbAuth = {
    user: checkEnvVar('BITBUCKET_USER'),
    appPassword: checkEnvVar('BITBUCKET_APP_PASSWORD'),
};
// const githubToken = checkEnvVar('GITHUB_TOKEN', 'token');
const githubOrg = checkEnvVar('GITHUB_ORG');
const githubTeam =  checkEnvVar('GITHUB_TEAM');
const githubTopics = checkEnvVar('GITHUB_TOPICS').split(',');


const expandTopics = (topics) => {
   return topics.reduce((args, topic) => { 
        return args += `--add-topic "${topic}" `;
    }, '')
};

console.log(process.cwd());

const cleanup = process.env.CLEANUP_REPOS === 'true';
const bb = process.env.BB_TEST === 'true';

// process.exit();

// testing bitbucket branch
if (bb) {
    const repo = repos[0];
    console.log(`bitbucketing ${repo.name}`);
    const reverse = true;

    const rslug = reverse ? `_gh_${repo.name}` : repo.name;

    const r = await getRepo(bitbucketOrg, rslug, bbAuth);
    // console.log(r);

    const migrationMsg = `Migrated to Github: ${githubOrg}/${repo.name} -`;

    const { description } = r;
    console.log(JSON.stringify(description));
    const newDescription = reverse ? description.replace(migrationMsg, '') : `${migrationMsg} ${description}`;
    console.log(JSON.stringify(newDescription))

    const t = await renameRepo(bitbucketOrg, repo.name, bbAuth, newDescription, reverse);
    process.exit();
}



const migrationMsg = (repoName) => `Migrated to Github: ${githubOrg}/${repoName} -`;

if (cleanup) {
   
    for (const repo of repos) {
       const repoDir = `repomirrors/${repo.name}`;
       execSync(`rm -rf ${repoDir}`, { stdio: 'inherit'});
       const bbSlug = `_gh_${repo.name}`
       const ghSlug = repo.newGHName ? repo.newGHName : repo.name;
       const { description } = await getRepo(bitbucketOrg, bbSlug, bbAuth);
       const newDescription = description.replace(migrationMsg(ghSlug), '');
       await renameRepo(bitbucketOrg, repo.name, bbAuth, newDescription, true);
       execSync(`gh repo delete "${githubOrg}/${ghSlug}" --yes`, { stdio: 'inherit' });
    }
} else {
    for (const repo of repos) {
        const repoDir = `repomirrors/${repo.name}`;
        execSync(`git clone --mirror https://bitbucket.org/${bitbucketOrg}/${repo.name}.git ${repoDir}`, { stdio: 'inherit'});
        execSync(`gh repo create "${githubOrg}/${repo.name}" --team="${githubTeam}" --internal`, { stdio: 'inherit' });
        execSync(`gh repo-collab add "${githubOrg}/${repo.name}" "${githubOrg}/${githubTeam}" --permission admin`); // no stdio for skipping prompt
        for (const admin of repo.additionalAdmins) {
            execSync(`gh repo-collab add "${githubOrg}/${repo.name}" "${githubOrg}/${admin}" --permission admin`); // no stdio for skipping prompt
        }
        execSync(`git remote add github "https://github.com/${githubOrg}/${repo.name}.git"`, { stdio: 'inherit', cwd: `${repoDir}` });
        execSync(`git push github --all`, { stdio: 'inherit', cwd: `${repoDir}` });

        // LFS 
        execSync(`git lfs fetch --all`, { stdio: 'inherit', cwd: `${repoDir}` });
        execSync(`git lfs pull`, { stdio: 'inherit', cwd: `${repoDir}` });
        const lsFilesList = execSync(`git lfs ls-files --all --long`, { cwd: `${repoDir}` }).toString();
        const lsFiles = lsFilesList.split('\n').map((line) => {
            return {
                objectId: line.split(' - ')[0],
                name: line.split(' - ')[1],
            };
        });
        lsFiles.forEach(({ objectId, name }) => {
            if (objectId){
                console.log(`pushing LFS object ${objectId} - ${name}`);
                execSync(`git lfs push --object-id github "${objectId}"`, { stdio: 'inherit', cwd: `${repoDir}` });
            }
        });


        // topics
        execSync(`gh repo edit ${expandTopics([...githubTopics, ...repo.additionalTopics])} "${githubOrg}/${repo.name}"`, { stdio: 'inherit' });
        const { description } = await getRepo(bitbucketOrg, repo.name, bbAuth);
        if (description) {
            execSync(`gh repo edit --description "${description}" "${githubOrg}/${repo.name}"`, { stdio: 'inherit' });
        }

        // rename
        if (repo.newGHName) {
            execSync(`gh repo rename "${repo.newGHName}" --repo "${githubOrg}/${repo.name}"`, { stdio: 'inherit' });
        }

        // archive
        if (repo?.archive === true) {
            execSync(`gh repo archive "${githubOrg}/${repo.name}" --yes`, { stdio: 'inherit' });
        }

        if (repo?.deprecateBitbucket === true) {
            const ghSlug = repo.newGHName ? repo.newGHName : repo.name;
            const newDescription = `${migrationMsg(ghSlug)} ${description}`;
            await renameRepo(bitbucketOrg, repo.name, bbAuth, newDescription);
        }
        console.log(`Finished migrating ${repo.name}`)
    }
}

