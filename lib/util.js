const xml2js = require('xml2js');


const xmlParser = new xml2js.Parser({ explicitRoot: false, explicitArray: false });
const xmlBuilder = new xml2js.Builder({ rootName: 'xml', headless: true, cdata: true });

const parseXml = xmlParser.parseString.bind(xmlParser);
const buildObject = xmlBuilder.buildObject.bind(xmlBuilder);

// 解板XML数据
function parseXMLSync(str) {
  return new Promise(function (resolve, reject) {
    xmlParser.parseString(str, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

module.exports = { parseXml, buildObject, parseXMLSync };
