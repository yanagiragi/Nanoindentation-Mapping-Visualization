const fs = require('fs')
const THREE = require('three') // required peer dependency
const threelut = require('three-lut')
const sanitize = require('sanitize-filename')

// configs not allow to modified at runtime
const shouldPrintCheetSheet = true
const matrixCount = 64
const matrixResolution =  parseInt(Math.sqrt(matrixCount))
const colors = 512
const mode = 'blackbody'
const lookupTable = new THREE.Lut(mode, colors)

/******** setup configs ********/ 
const dataPath = process.argv[2] || "null"
const resolution = parseInt(process.argv[3]) || "null"

if(dataPath === `null` || resolution === `null`){
    console.log(`node main.js data.txt $resolution`)
    console.log('Abort.')
    process.exit()
}
else if(resolution < matrixCount){
    console.log(`Resolution should bigger than ${matrixCount}`)
    console.log('Abort.')
    process.exit()
}

/******** read data ********/ 
let rawData = fs.readFileSync(dataPath)
let data = rawData.toString().split('\n').splice(3)

if(data[data.length - 1] === ``)
        data = data.splice(0, data.length - 1)

console.log(`Data Amount = ${data.length}`)

let columnData = rawData.toString().split('\n').splice(2, 1)[0].replace('\r','').split('\t')
const columnAmount = columnData.length
console.log(`ColumnAmount = ${columnAmount}`)

let valid = (data.length) % 64
if(valid != 0)
{
    console.log(`\tdata amount is not multiple of ${matrixCount}`)
    console.log(`\tAbort.`)

    let shame = fs.readFileSync('shame.css').toString()
        console.log(shame)
    process.exit()
}    

let differences = collectDifference(getSplitedData(data))

/******** slice data into batched of data (each matrixCount as a batch) and process ********/ 
for(let i = 0; i < data.length / matrixCount; ++i)
{
    let batchedData = data.reduce((acc, ele, idx) => {
        if(idx >= i * matrixCount && idx < (i * matrixCount + matrixCount))
            return acc.concat(ele)
        return acc
    },[])

    console.log(`process batchedData: ${batchedData[0].split('\t')[0]} ~ ${batchedData[batchedData.length - 1].split('\t')[0]}`)
    
    process64(i, batchedData)

    console.log(``)
}

/******** Print Cheet Sheet ********/ 
if(shouldPrintCheetSheet)
{    
    console.log('=======================================================')
    console.log('<3 CheetSheet <3 :')
    
    for(let i = 0; i < data.length / matrixCount; ++i)
    {
        printCheetSheet(i, columnData)
    }
    console.log('=======================================================')
}

function getSplitedData(data)
{    
    let splittedData = []
    for(let i = 0; i < data.length; ++i)
    {
        let splitted =  data[i].replace('\r','').split('\t')

        if(splitted.length != columnAmount)
        {
            splitted = []
            for(let j = 0; j < columnAmount; ++j)
            {
                splitted.push(0)
            }        
        }

        splittedData.push(splitted)
    }
    return splittedData
}

function collectDifference(data)
{
    let differences = [{min: Infinity, max: -Infinity}]

    let columnAmount = columnData.length

    for(let j = 1; j < columnAmount; ++j)
        differences.push({min: Infinity, max: -Infinity})

    for(let j = 1; j < columnAmount; ++j)
    {    
        let minIndex = 0, maxIndex = 0
        for(let i = 0; i < data.length; ++i)
        {
            if(parseFloat(data[i][j]) < parseFloat(data[minIndex][j])){
                minIndex = i
            }

            if(parseFloat(data[i][j]) > parseFloat(data[maxIndex][j])){
                maxIndex = i
            }
            
        }

        let min = parseFloat(data[minIndex][j])
        let max = parseFloat(data[maxIndex][j])
        
        if(min < differences[j].min)
            differences[j].min = min
        if(max > differences[j].max)
            differences[j].max = max
    }

    console.log(`Statistics:`)

    for(let j = 1; j < columnAmount; ++j)
        console.log(`\t${columnData[j]} = `, differences[j].min, differences[j].max, differences[j].max - differences[j].min)
    
    console.log(``)

    return differences
}

function process64(prefixIndex, data)
{
    let splittedData = getSplitedData(data)

    // post process data

    // skip File column
    for(let j = 1; j < splittedData[0].length; ++j)
    {    
        let diff = differences[j].max - differences[j].min

        for(let i = 0; i < splittedData.length; ++i)
        {
            splittedData[i][j] = (parseFloat(splittedData[i][j]) - differences[j].min) / diff
            if(splittedData[i][j] > 1 || splittedData[i][j] < 0){
                console.log(`\tcaught Exception = ${splittedData[i][j]}`)
            }
        }
        
    }

    // write to ppm
    for(let j = 1; j < splittedData[0].length; ++j)
    {    
        let ppmData = ""

        ppmData += `P3\n${resolution} ${resolution}\n${255}\n`

        for(let y = 0; y < resolution; ++y){
            for(let x = 0; x < resolution; ++x) {
                
                let matX = parseInt(x / resolution * matrixResolution)

                let matY = parseInt(y / resolution * matrixResolution)

                let index = matY * matrixResolution + matX

                let pixelValue = parseFloat(splittedData[index][j])

                let rgb = lookupTable.getColor(pixelValue)

                ppmData += `${parseInt(rgb.r * 255.0)} ${parseInt(rgb.g * 255.0)} ${parseInt(rgb.b * 255.0)} `
            }
        }
        
        let filename = prefixIndex + '_' + sanitize(columnData[j]) + '.ppm';
        fs.writeFileSync(filename, ppmData);
    }
}

function printCheetSheet(prefixIndex, columnData)
{
    for(let j = 1; j < columnData.length; ++j)
    {    
        let filename = prefixIndex + '_' + sanitize(columnData[j]) + '.ppm';
        let cmd = `magick.exe convert './${filename}' -flip '${filename}.png'`
        console.log(cmd)
    }
}