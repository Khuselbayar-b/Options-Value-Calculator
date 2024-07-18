import { config } from './config.js';

const ALPHA_VANTAGE_API_KEY = config.ALPHA_VANTAGE_API_KEY;

const stockSymbolInput = document.getElementById('stock-symbol');
const optionTypeSelect = document.getElementById('option-type');
const optionDateInput = document.getElementById('option-date');
const fetchDataButton = document.getElementById('fetch-data');
const optionsTable = document.getElementById('options-table');

fetchDataButton.addEventListener('click', fetchOptionData);

async function fetchOptionData() {
    const symbol = stockSymbolInput.value.toUpperCase();
    const optionType = optionTypeSelect.value.toLowerCase();
    const selectedDate = optionDateInput.value;

    try {
        // Fetch current stock price
        const quoteResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        const quoteData = await quoteResponse.json();
        console.log(quoteData)
        /*
        const currentPrice = parseFloat(quoteData['Global Quote']['05. price']);
        
        // Fetch options data
        const optionsResponse = await fetch(`https://www.alphavantage.co/query?function=HISTORICAL_OPTIONS&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        const optionsData = await optionsResponse.json();
        
        // Display the options table
        displayOptionsTable(optionsData.data, currentPrice, optionType, selectedDate);
        */
    } catch (error) {
        console.error('Error fetching option data:', error);
    }
}

function displayOptionsTable(optionsData, currentPrice, optionType, selectedDate) {
    // Filter options based on type, date, and strike price increment
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
    let tableHTML = `
        <h3>Current Stock Price: $${currentPrice.toFixed(2)}</h3>
        <table>
            <tr>
                <th>Strike Price</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>Middle</th>
                <th>Action</th>
                <th>Data</th>
            </tr>
    `;

    highestVolumeOptions.forEach(option => {
        const bid = parseFloat(option.bid);
        const ask = parseFloat(option.ask);
        const middle = ((bid + ask) / 2).toFixed(2);

        tableHTML += `
            <tr>
                <td>$${parseFloat(option.strike).toFixed(2)}</td>
                <td>$${bid.toFixed(2)}</td>
                <td>$${ask.toFixed(2)}</td>
                <td>$${middle}</td>
                <td><button onclick='selectOption(${JSON.stringify(option)}, ${currentPrice})'>Select</button></td>
            </tr>
        `;
    });

    tableHTML += '</table>';
    optionsTable.innerHTML = tableHTML;
}

function selectOption(option, currentPrice) {
    selectedOptionInfo.textContent = `Strike: $${option.strike}, Expiration: ${option.expiration}, Last Price: $${option.lastPrice}`;
    calculateOptionValues(option, currentPrice);
}

function calculateOptionValues(option, currentPrice) {
    const values = [];
    const currentDate = new Date();
    const expirationDate = new Date(option.expiration);

    for (let date = currentDate; date <= expirationDate; date.setDate(date.getDate() + 1)) {
        values.push({
            date: new Date(date),
            value: blackScholes(currentPrice, parseFloat(option.strike), (expirationDate - date) / (1000 * 60 * 60 * 24) / 365, 0.05, 0.3, option.type === 'call')
        });
    }

    displayHeatMap(values, parseFloat(option.lastPrice));
}

// The blackScholes, cdf, and displayHeatMap functions remain the same as in the previous version