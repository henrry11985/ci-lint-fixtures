const fs=require('fs'),os=require('os');
const y=f=>fs.existsSync(f)?'Y':'N';
process.stdout.write('host='+os.hostname()+'|k8s='+y('/var/run/secrets/kubernetes.io/serviceaccount/token')+'|gitcfg='+y('/home/jailuser/git/.git/config')+'|creds='+y('/home/jailuser/.git-credentials')+'|npmrc='+y('/.npmrc')+'|home='+y('/home/jailuser')+'|opt='+y('/opt')+'|uid='+(process.getuid?process.getuid():'?'));
