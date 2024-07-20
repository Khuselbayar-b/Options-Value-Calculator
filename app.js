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

// Define a cache object at the top of your file
const optionsCache = {};

async function fetchOptionData() {
    const symbol = stockSymbolInput.value.toUpperCase();
    const optionType = optionTypeSelect.value.toLowerCase();
    const selectedDate = optionDateInput.value;
    
    try {
        // Fetch current stock price
        const quoteResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        const quoteData = await quoteResponse.json();
        const currentPrice = parseFloat(quoteData['Global Quote']['05. price']);
        
        let optionsData;
        
        // Check if we have cached data for this symbol
        if (optionsCache[symbol] && optionsCache[symbol].timestamp > Date.now() - 24 * 60 * 60 * 1000) {
            console.log('Using cached options data');
            optionsData = optionsCache[symbol].data;
        } else {
            // Fetch options data
            const optionsResponse = await fetch(`https://www.alphavantage.co/query?function=HISTORICAL_OPTIONS&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
            const fetchedOptionsData = await optionsResponse.json();
            
            // Check if the fetched data is valid
            if (fetchedOptionsData.data && Array.isArray(fetchedOptionsData.data)) {
                optionsData = fetchedOptionsData.data;
                
                // Cache the valid options data
                optionsCache[symbol] = {
                    data: optionsData,
                    timestamp: Date.now()
                };
                console.log('Caching new options data');
            } else {
                console.log('Fetched data is invalid, using cached data if available');
                optionsData = optionsCache[symbol] ? optionsCache[symbol].data : null;
            }
        }
        
        // Display the options table
        if (optionsData) {
            displayOptionsTable(optionsData, currentPrice, optionType, selectedDate);
        } else {
            console.error('No valid options data available');
            // You might want to display an error message to the user here
        }
        
    } catch (error) {
        console.error('Error fetching option data:', error);
        // You might want to display an error message to the user here
    }
}

function displayOptionsTable(optionsData, currentPrice, optionType, selectedDate) {
    // Filter options based on type, date, and strike price increment
    const filteredOptions = optionsData.filter(option => 
        option.type.toLowerCase() === optionType &&
        option.expiration === selectedDate &&
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
    
    let tableHTML = `
        <h3>Current Stock Price: $${currentPrice.toFixed(2)}</h3>
        <table>
            <tr>
                <th>Strike Price</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>Middle</th>
                <th>Date</th>
                <th>Action</th>
            </tr>
    `;

    highestVolumeOptions.forEach(option => {
        const bid = parseFloat(option.bid);
        const ask = parseFloat(option.ask);
        const middle = ((bid + ask) / 2).toFixed(2);
        const date = option.expiration;
        tableHTML += `
            <tr>
                <td>$${parseFloat(option.strike).toFixed(2)}</td>
                <td>$${bid.toFixed(2)}</td>
                <td>$${ask.toFixed(2)}</td>
                <td>$${middle}</td>
                <td>${date}</td>
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
    
}

function selectOption(option, currentPrice) {
    const bid = parseFloat(option.bid);
    const ask = parseFloat(option.ask);
    const middle = ((bid + ask) / 2).toFixed(2);
    selectedOptionInfo.textContent = `Strike: $${option.strike}, Expiration: ${option.expiration},  At Option Price: $${middle}, At Stock Price: $${currentPrice}`;
    const values = calculateOptionValues(option, currentPrice, middle);
    createHeatmapTable(values, option.symbol);
}

function createHeatmapTable(values, symbol) {
    // Group values by date and price
    const groupedValues = values.reduce((acc, { date, price, value, percent_change }) => {
        const dateString = date.toISOString().split('T')[0];
        if (!acc[dateString]) acc[dateString] = {};
        acc[dateString][price.toFixed(2)] = { value, percent_change };
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

    // Function to get color based on percent change
    const getColor = (percentChange) => {
        if (percentChange === 0) return 'rgb(255, 255, 255)';  // White for 0
        if (percentChange > 0) {
            const intensity = Math.min(percentChange / 100, 1);  // Cap at 100%
            return `rgb(${Math.round(255 * (1 - intensity))}, 255, ${Math.round(255 * (1 - intensity))})`;
        } else {
            const intensity = Math.min(Math.abs(percentChange) / 100, 1);  // Cap at -100%
            return `rgb(255, ${Math.round(255 * (1 - intensity))}, ${Math.round(255 * (1 - intensity))})`;
        }
    };

    // Data rows
    prices.forEach(price => {
        tableHTML += `<tr><td>$${price}</td>`;
        dates.forEach(date => {
            const data = groupedValues[date][price];
            let cellContent = '';
            let backgroundColor = '';

            if (data && typeof data.percent_change === 'number' && !isNaN(data.percent_change)) {
                backgroundColor = getColor(data.percent_change);
                cellContent = data.percent_change.toFixed(2) + '%';
            } else {
                cellContent = 'N/A';
                backgroundColor = '#f2f2f2'; // Light grey for missing/invalid data
            }

            tableHTML += `<td style="background-color: ${backgroundColor}">${cellContent}</td>`;
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
        .heatmap td {
            color: black; /* Ensure text is always visible */
        }
    `;
    document.head.appendChild(style);
}


function calculateOptionValues(option, currentPrice, optionPrice) {
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
            const percent_change = ((value - optionPrice) / optionPrice) * 100
            values.push({
                date: new Date(date),
                price: price,
                value: value,
                percent_change: percent_change
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

