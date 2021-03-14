const fs = require("fs");
const path = require("path");
const cql = require("cql-execution");
const cqlfhir = require("cql-exec-fhir");
const cqlvsac = require("cql-exec-vsac");

(async function (){
    try {
        if (process.env.NODE_ENV !== 'production') {
            require('dotenv').config();
        }

        const MEASURE_PACKAGE = process.env.MEASURE_PACKAGE

        const bundlesPath = path.join(__dirname, 'bundles');
        const measurePath = path.join(__dirname, 'measure-packages', MEASURE_PACKAGE);

        const library = libraryBuilder(measurePath);
        const codeService = new cqlvsac.CodeService(
            path.join(measurePath, 'vsac_cache'),true);

        await codeService.ensureValueSetsInLibraryWithAPIKey(library, true , undefined, true)
        console.log('All the value sets in place');

        const executor = new cql.Executor(library, codeService, undefined);
        const patientSource = cqlfhir.PatientSource.FHIRv401();
        // await client.connect()
        //     .then(() => console.log("[pg]: Connected successfully"));

        // const bundles = bundlesBuilder(bundlesPath)
        // console.log(patients)

        for (const fileName of fs.readdirSync(bundlesPath)) {

            const file = path.join(bundlesPath, fileName)
            if (!file.endsWith('.json')){
                continue;
            }
            const bundle = JSON.parse(fs.readFileSync(file, 'utf8'))


            patientSource.loadBundles([bundle])
            // // execution:
            const result = (executor.exec(patientSource))

            // console.log(result.patientResults)
            for (const [patientID, resultSet] of Object.entries(result.patientResults)){

                for (const [measure, v] of Object.entries(resultSet)){
                    if (measure === 'Patient') {
                        let pName = 'none'
                        try {
                            pName = `${v.name[0]['family']['value']} ${v.name[0]['given'][0]['value']}`
                        } catch (err) {}
                        console.log(`\n[Patient name: ${pName}]:`)

                    } else {
                        console.log(`[Patient id=${patientID}] => ${measure}: ${v}`)
                    }
                }
            }
        }
        console.log('\nEnd')
    } catch (err){
        console.log(err, err.stack)
    }
})()

function libraryBuilder(mPath) {
    // Load main executable ELM file from mPath (measurePath)
    const mainCql = JSON.parse(fs.readFileSync(
        path.join(mPath, `main.json`),'utf8'));

    // Load included libraries from mainCql
    const includes = mainCql.library.includes && mainCql.library.includes.def || [];
    let includedLibs = {};
    includes.forEach((l)=>{
        includedLibs[l.localIdentifier] = JSON.parse(fs.readFileSync(path.join(mPath, `${l.path}-${l.version}.json`), 'utf8'));
    });

    // Return Library
    return new cql.Library(mainCql, new cql.Repository(includedLibs));
}