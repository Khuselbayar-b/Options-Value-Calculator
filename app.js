import { config } from './config.js';

const ALPHA_VANTAGE_API_KEY = config.ALPHA_VANTAGE_API_KEY;

const stockSymbolInput = document.getElementById('stock-symbol');
const optionTypeSelect = document.getElementById('option-type');
const optionDateInput = document.getElementById('option-date');
const fetchDataButton = document.getElementById('fetch-data');
const optionsTable = document.getElementById('options-table');
const selectedOptionInfo = document.getElementById('selected-option-info');

fetchDataButton.addEventListener('click', () => {
    fetchOptionData();
});

async function fetchOptionData() {
    const symbol = stockSymbolInput.value.toUpperCase();
    const optionType = optionTypeSelect.value.toLowerCase();
    const selectedDate = optionDateInput.value;

    try {
        // Fetch current stock price
        const quoteResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        const quoteData = await quoteResponse.json();
        const currentPrice = parseFloat(quoteData['Global Quote']['05. price']);
        
        // Fetch options data
        const optionsResponse = await fetch(`https://www.alphavantage.co/query?function=HISTORICAL_OPTIONS&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        const optionsData = await optionsResponse.json();
        // Display the options table
        displayOptionsTable(optionsData.data, currentPrice, optionType, selectedDate);
        
    } catch (error) {
        console.error('Error fetching option data:', error);
    }
}

function displayOptionsTable(optionsData, currentPrice, optionType, selectedDate) {
    // Filter options based on type, date, and strike price increment
    console.log(optionsData)
    const filteredOptions = optionsData.filter(option => 
        option.type.toLowerCase() === optionType &&
        option.date === selectedDate &&
        parseFloat(option.strike) % 5 === 0
    );
    // Group options by strike price and select the one with the highest volume for each group
    const groupedOptions = {};
    filteredOptions.forEach(option => {
        const strike = parseFloat(option.strike).toFixed(2);
        if (!groupedOptions[strike] || parseInt(option.volume) > parseInt(groupedOptions[strike].volume)) {
            groupedOptions[strike] = option;
        }
    });

    // Convert grouped options to an array and sort by strike price
    const highestVolumeOptions = Object.values(groupedOptions);
    highestVolumeOptions.sort((a, b) => parseFloat(a.strike) - parseFloat(b.strike));
    // Generate table HTML
    /*
    let tableHTML = `
        <h3>Current Stock Price: $${currentPrice.toFixed(2)}</h3>
        <table>
            <tr>
                <th>Strike Price</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>Middle</th>
                <th>Action</th>
            </tr>
    `;

    highestVolumeOptions.forEach(option => {
        const bid = parseFloat(option.bid);
        const ask = parseFloat(option.ask);
        const middle = ((bid + ask) / 2).toFixed(2);
        const date = parseFloat(option.date);
        console.log(date)
        tableHTML += `
            <tr>
                <td>$${parseFloat(option.strike).toFixed(2)}</td>
                <td>$${bid.toFixed(2)}</td>
                <td>$${ask.toFixed(2)}</td>
                <td>$${middle}</td>
                <td><button class="select-option" data-option='${JSON.stringify(option)}' data-current-price="${currentPrice}">Select</button></td>
            <tr>
        `;
    });

    tableHTML += '</table>';
    optionsTable.innerHTML = tableHTML;
    optionsTable.addEventListener('click', function(event) {
    if (event.target.classList.contains('select-option')) {
        const option = JSON.parse(event.target.dataset.option);
        const currentPrice = parseFloat(event.target.dataset.currentPrice);
        selectOption(option, currentPrice);
    }
    });
    */
}

function selectOption(option, currentPrice) {
    selectedOptionInfo.textContent = `Strike: $${option.strike}, Expiration: ${option.expiration}, At Stock Price: $${currentPrice}`;
    const values = calculateOptionValues(option, currentPrice);
    createHeatmapTable(values, option.symbol);
}

function createHeatmapTable(values, symbol) {
    // Group values by date and price
    const groupedValues = values.reduce((acc, { date, price, value }) => {
        const dateString = date.toISOString().split('T')[0];
        if (!acc[dateString]) acc[dateString] = {};
        acc[dateString][price.toFixed(2)] = value;
        return acc;
    }, {});

    const dates = Object.keys(groupedValues).sort();
    const prices = [...new Set(values.map(v => v.price.toFixed(2)))].sort((a, b) => b - a);

    let tableHTML = `<table class="heatmap">`;
    
    // Header row with dates
    tableHTML += `<tr><th>${symbol}</th>`;
    dates.forEach(date => {
        tableHTML += `<th>${date}</th>`;
    });
    tableHTML += `</tr>`;

    // Data rows
    prices.forEach(price => {
        tableHTML += `<tr><td>$${price}</td>`;
        dates.forEach(date => {
            const value = groupedValues[date][price] || '';
            const normalizedValue = value ? (value - Math.min(...values.map(v => v.value))) / (Math.max(...values.map(v => v.value)) - Math.min(...values.map(v => v.value))) : 0;
            const backgroundColor = `hsl(240, 100%, ${100 - normalizedValue * 50}%)`;
            tableHTML += `<td style="background-color: ${backgroundColor}">${value.toFixed(2)}</td>`;
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</table>`;

    // Assuming you have a div with id 'heatmap-container' to put the table in
    const container = document.getElementById('heatmap-container');
    if (container) {
        container.innerHTML = tableHTML;
    } else {
        console.error('Heatmap container not found');
    }

    // Add some basic styles
    const style = document.createElement('style');
    style.textContent = `
        .heatmap {
            border-collapse: collapse;
            font-size: 12px;
        }
        .heatmap th, .heatmap td {
            border: 1px solid #ddd;
            padding: 4px;
            text-align: right;
        }
        .heatmap th {
            background-color: #f2f2f2;
        }
    `;
    document.head.appendChild(style);
}


function calculateOptionValues(option, currentPrice) {
    const values = [];
    const currentDate = new Date();
    const expirationDate = new Date(option.expiration);
    
    // Define the range of prices (e.g., ±20% of current price)
    const priceRange = 0.2;
    const priceStep = currentPrice * priceRange / 10; // 20 steps total
    for (let date = new Date(currentDate); date <= expirationDate; date.setDate(date.getDate() + 1)) {
        const timeToExpiry = (expirationDate - date) / (1000 * 60 * 60 * 24) / 365;
        
        for (let i = -10; i <= 10; i++) {
            const price = currentPrice + i * priceStep;
            const value = blackScholes(
                price, 
                parseFloat(option.strike), 
                timeToExpiry, 
                0.05, // risk-free rate
                0.3,  // volatility
                option.type
            );
            values.push({
                date: new Date(date),
                price: price,
                value: value
            });
        }
    }

    console.log(values);
    return values;
}


function blackScholes(S, K, T, r, sigma, optionType) {
    // S: current stock price
    // K: strike price
    // T: time to maturity in years
    // r: risk-free interest rate
    // sigma: volatility
    // optionType: 'call' or 'put'
    const d1 = (Math.log(S / K) + (r + Math.pow(sigma, 2) / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const cdf = (x) => 0.5 * (1 + erf(x / Math.sqrt(2)));
    console.log(optionType)
    if (optionType === 'call') {
        const res = S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2)
        return res;
    } else if (optionType === 'put') {
        return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
    } else {
        throw new Error("Invalid option type. Must be 'call' or 'put'.");
    }
}

// Error function approximation
function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}

