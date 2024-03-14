const fs = require("fs");
const date = require("silly-datetime");
const CdnClient = require("tencentcloud-sdk-nodejs").cdn.v20180606.Client;

const Client = new CdnClient({
    credential: {
        secretId: "",  // 拥有 QcloudCDNFullAccess 权限的子账号
        secretKey: ""
    },
    // region: "ap-shanghai",
    profile: {
        httpProfile: {
            endpoint: "cdn.tencentcloudapi.com"
        }
    }
});
const GlobalData = {
    template: {
        "Domain": "",
        "Https": {
            "CertInfo": {
                "Certificate": "",
                "PrivateKey": "",
                "Message": "更新日期：" + date.format(new Date(), 'YYYY-MM-DD HH:mm')
            }
        }
    }
};

const QueryDomainConfigData = {
    template: {
        "Filters": [
            {
                "Name": "domain",
                "Value": []
            }
        ]
    }
}

/** 
 * 查询域名配置
 * @param domain 域名
 * @returns {Boolean} 是否需要更新证书
 */
function queryDomainConfig(domain) {
    const params = QueryDomainConfigData.template;
    params.Filters[0].Value.push(domain);
    Client.DescribeDomainsConfig(params).then((data) => {
        const cert_expire_time = new Date(data['Domains'][0]['Https']['CertInfo']['ExpireTime']);
        const now_time = new Date();
        if (cert_expire_time - now_time < 1 * 24 * 60 * 60 * 1000) {
            console.log(`域名 【${domain}】 证书即将过期，开始更新证书。`);
            return true;
        } else {
            console.log(`域名 【${domain}】 证书未到期，无需更新。`);
            return false;
        }
    }, (err) => {
        console.error(domain, "CDN 域名详细信息查询失败：", err);
        return False
    })
}

/**
 * 根据域名生成对应配置
 * @param domain 域名
 */
function genParam(domain) {
    let cert, key;
    const temp = GlobalData.template;

    // 新证书在此添加
    if (domain.includes('example.com')) {
        if (!queryDomainConfig(domain)) return null;
        cert = fs.readFileSync("fullchain.pem", 'utf-8');
        key = fs.readFileSync("privkey.pem", 'utf-8');
    } else if (domain.includes('b.example.com')) {
        if (!queryDomainConfig(domain)) return null;
        cert = fs.readFileSync("fullchain.pem", 'utf-8');
        key = fs.readFileSync("privkey.pem", 'utf-8');
    } else {
        return null;
    }
    temp.Domain = domain;
    temp.Https.CertInfo.Certificate = cert;
    temp.Https.CertInfo.PrivateKey = key;
    return temp;
}

/**
 * 部署证书
 */
Client.DescribeDomains({}).then((data) => {
    const domainList = [];
    if (data['Domains']) data['Domains'].forEach(item => {
        if (item['Domain']) domainList.push(item['Domain'])
    })
    domainList.forEach(domain => {
        setTimeout(() => {
            const param = genParam(domain);
            if (!param) return;
            Client.UpdateDomainConfig(param).then(
                () => {
                    console.log(`域名 【${domain}】 更新证书完成。`);
                }, err => {
                    console.error(`域名 【${domain}】 更新失败： ${err}`);
                }
            )
        }, 100)
    })
}, (err) => {
    console.error("CDN 域名查询失败：", err);
})
