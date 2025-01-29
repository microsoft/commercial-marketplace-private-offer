// Variables
let _thisMonth = new Intl.DateTimeFormat('default', { month: 'long' }).format(new Date());
let _thisYear = new Date().getFullYear();

let _pricePerPayment, _startDate = new Date(), _endDate = new Date();
let _pricingModel = "Flat rate", _billingTerm ="N/A", _paymentOption="N/A", _exceptionScenario;
let _autoRenew = false;

let _payment = {
    id: 0,
    amount: 0,
    dueDate: new Date()
};

let _payments = [];
let _privateOffer = {
    id: 0,
    numberOfPayments: 0,
    startDate: new Date(),
    endDate: new Date(),
    amount: 0
};

let _privateOffers = [];

let _contractTotal, _numberOfPayments, _paymentFrequency, _variableAmounts, _singlePayment, _delayBilling;

document.querySelector('.currency-symbol').textContent = new Intl.NumberFormat('default', { style: 'currency', currency: 'USD' }).format(0).replace(/\d/g, '');

// Add event listener for Configure Offer button
document.addEventListener('DOMContentLoaded', function () {
    const configureButton = document.getElementById('cmdConfigure');
    let isConfigured = false;

    configureButton.addEventListener('click', function () {
        if (isConfigured) {
            // If the button is in "Reset Configuration" mode, reset the form and toggle back to "Configure Offer"
            resetForm();
            configureButton.textContent = 'Configure Offer';
            isConfigured = false;
        } else {
            // If the button is in "Configure Offer" mode, proceed with configuration and toggle to "Reset Configuration"
            SelectScenario();
            configureButton.textContent = 'Reset Configuration';
            isConfigured = true;
        }
    });
});

function resetForm() {
   // Reset form inputs, excluding the _contractTotal field
   const contractTotalInput = document.getElementById('contractTotal');
   const contractTotalValue = contractTotalInput.value;  // Save current _contractTotal input value
   
   document.getElementById('privateOfferForm').reset();  // Reset the form

   // Restore _contractTotal value to the input field after resetting
   contractTotalInput.value = contractTotalValue;

   // Hide advanced options if visible
   document.getElementById('advancedOptions').classList.add('d-none');

   // Clear any generated output content
   document.getElementById('output').innerHTML = '';

   // Reset any other necessary global variables while keeping _contractTotal intact
   _numberOfPayments = 0;
   _paymentFrequency = '';
   _variableAmounts = false;
   _singlePayment = false;
   _delayBilling = false;
   _pricePerPayment = 0;
   _privateOffers.length = 0;
   _payments.length = 0;
}

// Ensure only one checkbox can be checked at a time
let checkboxes = document.querySelectorAll('input[type="checkbox"]');
checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', function () {
        checkboxes.forEach((box) => {
            if (box !== checkbox) box.checked = false;
        });
    });
});

// JavaScript to toggle the visibility of advanced options
document.getElementById('showAdvancedOptions').addEventListener('change', function() {
    const advancedOptions = document.getElementById('advancedOptions');
    if (this.checked) {
        advancedOptions.classList.remove('d-none');
    } else {
        advancedOptions.classList.add('d-none');
    }
});

function formatCurrency(amount) {
    return new Intl.NumberFormat('default', { style: 'currency', currency: 'USD' }).format(amount);
}
// Example usage: formatCurrency(_pricePerPayment)

function formatNumber(number) {
    return new Intl.NumberFormat('default', { maximumFractionDigits: 2 }).format(number);
}

function detectLocaleDateOrder() {
    const sampleDate = new Date(2024, 10, 5); // November 5, 2024
    const formattedDate = sampleDate.toLocaleDateString();

    if (formattedDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [part1, part2] = formattedDate.split('/');
        return part1 === "11" ? "MM/dd/yyyy" : "dd/MM/yyyy";
    } else if (formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return "yyyy-MM-dd";
    }

    console.warn("Unknown date format, defaulting to MM/dd/yyyy");
    return "MM/dd/yyyy"; // Default if detection fails
}

function stringToDate(input) {
    // Check if input is already a Date object; if so, return it as is
    if (input instanceof Date) {
        return input;
    }

    // Ensure input is a string, otherwise log an error and return null
    if (typeof input !== 'string') {
        console.error("Expected a string for date input, but received:", input);
        return null;
    }

    const format = detectLocaleDateOrder(); // Get the detected locale date order
    const parts = input.split(/[-/]/).map(Number);
    const today = new Date();
    const currentDay = today.getDate();

    // Case 1: Handle full date based on detected locale format
    if (parts.length === 3) {
        if (format === "dd/MM/yyyy") {
            return new Date(parts[2], parts[1] - 1, parts[0]); // day, month, year
        } else if (format === "MM/dd/yyyy") {
            return new Date(parts[2], parts[0] - 1, parts[1]); // month, day, year
        } else if (format === "yyyy-MM-dd") {
            return new Date(parts[0], parts[1] - 1, parts[2]); // year, month, day
        }
    }

    // Case 2: Handle MM/YYYY format by adding the current day
    if (parts.length === 2 && parts[0] <= 12 && parts[1] >= 1000) {
        return new Date(parts[1], parts[0] - 1, currentDay);
    }

    console.error("Unsupported or invalid date format:", input);
    return null;
}


// Select Scenario function
function SelectScenario() {
    // Update variables based on user input
    _contractTotal = parseFloat(document.getElementById('contractTotal').value);
    _numberOfPayments = parseInt(document.getElementById('numberOfPayments').value);
    _paymentFrequency = document.getElementById('paymentFrequency').value;
    _variableAmounts = document.getElementById('variableAmounts').checked;
    _singlePayment = document.getElementById('singlePayment').checked;
    _delayBilling = document.getElementById('delayBilling').checked;

    _billingTerm = _paymentFrequency;
    _paymentOption = "One-time";
    _pricePerPayment = _contractTotal / _numberOfPayments;

    // Determine the configuration scenario
    if (_variableAmounts) {
        VariableAmounts();
    } else if (_singlePayment) {
        SinglePayment();
    } else if (_delayBilling) {
        DelayedBilling();
    } else {
        SinglePrivateOffer();
    }
}

// Scenario functions
function SinglePayment() {
    // Set the number of payments to 1 and payment frequency to 'Month'
    document.getElementById('numberOfPayments').value = 1;
    document.getElementById('paymentFrequency').value = 'Month';

    _numberOfPayments = 1;
    _paymentFrequency = 'Month';
    _billingTerm = "Month";
    _contractTotal = parseFloat(document.getElementById('contractTotal').value);

    // Get the current date in MM/YYYY format
    const today = new Date();
    const currentMonthYear = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    // Clear existing content
    let output = document.getElementById('output');
    output.innerHTML = '';

    // Create form for single payment details
    let formContent = `
        <form id="singlePaymentForm">
            <div class="mb-3">
                <label for="paymentAmount" class="form-label">Payment Amount (USD)</label>
                <input type="number" class="form-control" id="paymentAmount" value="${_contractTotal}" readonly style="background-color: #e9ecef;">
                <small id="paymentHelp" class="form-text text-muted">The total deal amount to be invoiced as a single payment.</small>
            </div>
            <div class="mb-3">
                <label for="paymentDate" class="form-label">Charge Date</label>
                <input type="text" class="form-control" id="paymentDate" value="${currentMonthYear}" readonly style="background-color: #e9ecef;">
                <small id="dateHelp" class="form-text text-muted">The expected invoice charge date for the single payment (MM/YYYY).</small>
            </div>
            <div class="mb-3">
                <label for="subscriptionEndDate" class="form-label">Subscription End Date</label>
                <input type="text" class="form-control" id="subscriptionEndDate" placeholder="MM/YYYY" pattern="^(0[1-9]|1[0-2])/\\d{4}$" aria-describedby="endDateHelp" required>
                <small id="endDateHelp" class="form-text text-muted">The private offer subscription end date (MM/YYYY).</small>
            </div>
            <button type="button" class="btn btn-primary" id="submitSinglePayment">Configure Offer</button>
        </form>
    `;

    // Insert form content into the output element
    output.innerHTML = formContent;

    // Add event listener for the submit button to validate and generate the private offer
    document.getElementById('submitSinglePayment').addEventListener('click', () => {
        const subscriptionEndDate = document.getElementById('subscriptionEndDate').value;

        // Validate MM/YYYY format and year
        const datePattern = /^(0[1-9]|1[0-2])\/(\d{4})$/;
        const match = subscriptionEndDate.match(datePattern);
        if (!match) {
            alert('Please enter a valid date in MM/YYYY format.');
            return;
        }

        const month = parseInt(match[1]);
        const year = parseInt(match[2]);
        const currentYear = today.getFullYear();

        // Check if the year is valid
        if (year < currentYear) {
            alert('The year must be equal to or greater than the current year.');
            return;
        }

        // Proceed with saving if validations pass
        SaveSinglePayment();
    });
}

function SaveSinglePayment() {
    // Validate form data
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const subscriptionEndDate = document.getElementById('subscriptionEndDate').value;

    if (!paymentAmount || !paymentDate || !subscriptionEndDate) {
        alert('Please fill out all fields correctly.');
        return;
    }

    // Split the string into month and year
    let [month, year] = subscriptionEndDate.split("/");
  
    //Clear the private offers object
    _privateOffers.length = 0;

    // Initialize the first private offer based on the first payment
    _privateOffers.push({
        id: 1,
        numberOfPayments: 1,
        startDate: new Date(),
        endDate: new Date(),
        amount: paymentAmount,
    });

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + 1);

    _privateOffers.push({
        id: 2,
        numberOfPayments: 1,
        startDate: startDate, // Use the updated start date
        endDate: new Date(year, month -1, 1),
        amount: 0,
    });

    // Add logic to handle saving or processing the single payment details
    console.log('Payment Amount:', paymentAmount);
    console.log('Payment Date:', paymentDate);
    console.log('Start Date:', startDate);
    console.log('Subscription End Date:', subscriptionEndDate);

    DisplayPrivateOffers();
}

function VariableAmounts() {
    const output = document.getElementById('output');
    output.innerHTML = ''; // Clear existing content

    const initialInvoiceDate = new Date();
    let i = 1;
    _payments.length = 0; // Clear any previous payment entries

    // Create the layout for payments
    output.innerHTML += `
        <div class="container">
            <div class="row">
                <div class="col">
                    Payment Amount
                </div>
                <div class="col">
                    Charge Date
                </div>
            </div>
    `;

    for (i = 1; i <= _numberOfPayments; i++) {
        // Calculate the correct charge date for each payment
        let tmpInvoiceDate = new Date(initialInvoiceDate);
        const increment = i - 1;

        if (_paymentFrequency === 'Month') {
            tmpInvoiceDate.setMonth(tmpInvoiceDate.getMonth() + increment);

            // Check for month overflow and adjust if necessary
            if (tmpInvoiceDate.getDate() !== initialInvoiceDate.getDate()) {
                tmpInvoiceDate.setDate(0); // Set to last day of previous month
            }
        } else if (_paymentFrequency === 'Year') {
            tmpInvoiceDate.setFullYear(tmpInvoiceDate.getFullYear() + increment);
        }

        output.innerHTML += `
            <div class="row mb-2">
                <div class="col">
                    <input type="number" id="payment-${i}" value="${_pricePerPayment.toFixed(2)}" class="form-control payment-input">
                </div>
                <div class="col">
                    <input type="text" id="date-${i}" value="${FormatDateToMMYYYY(tmpInvoiceDate)}" class="form-control" readonly>
                </div>
            </div>
        `;

        _payments.push({
            id: i,
            amount: _pricePerPayment,
            dueDate: tmpInvoiceDate.toLocaleDateString()
        });
    }

    output.innerHTML += `</div>`;

    // Create the Save Payment Plan button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'View Private Offers configuration';
    saveButton.className = 'btn btn-success mt-3';
    saveButton.disabled = true; // Initially disabled
    saveButton.addEventListener('click', SavePayment);
    output.appendChild(saveButton);

    // Create the layout for displaying deal values
    const valuesContainer = document.createElement('div');
    valuesContainer.className = 'row text-center mt-3';

    valuesContainer.innerHTML = `
        <div class="col">
            <label>Deal Amount</label>
            <div id="dealAmount">${formatCurrency(_contractTotal)}</div>
        </div>
        <div class="col">
            <label>Total Payments Amount</label>
            <div id="totalPaymentsAmount">${formatCurrency(0)}</div>
        </div>
        <div class="col">
            <label>Amount Needed</label>
            <div id="amountNeeded">${formatCurrency(_contractTotal)}</div>
        </div>
    `;

    output.appendChild(valuesContainer);

    // Update values whenever payment inputs change
    document.querySelectorAll('.payment-input').forEach(input => {
        input.addEventListener('input', updateDealValues);
    });

    // Call updateDealValues initially to reflect default values in totalPaymentsAmount
    updateDealValues();

    function updateDealValues() {
        // Calculate total of all payment inputs
        let totalPayments = Array.from(document.querySelectorAll('.payment-input')).reduce((sum, input) => {
            return sum + parseFloat(input.value || 0);
        }, 0);

        // Calculate Amount Needed
        let amountNeeded = _contractTotal - totalPayments;

        // Update display values
        document.getElementById('totalPaymentsAmount').textContent = formatCurrency(totalPayments);
        document.getElementById('amountNeeded').textContent = formatCurrency(amountNeeded);

        // Enable Save button only if Amount Needed is zero
        saveButton.disabled = amountNeeded !== 0;
    }
}

function SavePayment() {
    let tmpTotal = 0;

    // Update payment amounts based on input values and calculate the total
    _payments.forEach((payment, index) => {
        const amountInput = parseFloat(document.getElementById(`payment-${index + 1}`).value.replace('$', ''));
        payment.amount = amountInput;
        tmpTotal += amountInput;
    });

    if (tmpTotal !== _contractTotal) {
        alert("The deal total does not match the sum of all payments: $" + tmpTotal.toFixed(2) + " vs $" + _contractTotal.toFixed(2) + ", please review the payment amounts and update as appropriate.");
    } else {    
        // Debug output to display the privateOffers object
        console.log("Debug: _payments", _payments); 

        //Calculate Private offers
        CalculatePrivateOffers();

        // Display the private offers
        DisplayPrivateOffers();

    }
    
}

function CalculatePrivateOffers() {
    let numberOfOffers = 1;
    let i = 0;

    // Clear the array to start fresh
    _privateOffers.length = 0;

    // Initialize the first private offer based on the first payment
    _privateOffers.push({
        id: numberOfOffers,
        numberOfPayments: 1,
        startDate: _payments[i].dueDate,
        endDate: AdjustEndDate(_payments[i].dueDate, 1),
        amount: _payments[i].amount,
    });

    // Iterate over the payments to calculate private offers
    for (let i = 1; i < _payments.length; i++) {
        // Check if the current payment does not belong to an existing offer
        if (_payments[i].amount !== _payments[i - 1].amount) {
            // Create a new private offer when payment amounts differ
            numberOfOffers++;
    
            _privateOffers.push({
                id: numberOfOffers,
                numberOfPayments: 1,
                startDate: _payments[i].dueDate,
                endDate: AdjustEndDate(_payments[i].dueDate, 1),
                amount: _payments[i].amount,
            });
        } else {
            // Update the current private offer if amounts are the same
            _privateOffers[numberOfOffers - 1].numberOfPayments++;
            _privateOffers[numberOfOffers - 1].endDate = AdjustEndDate(
                _privateOffers[numberOfOffers - 1].startDate,
                _privateOffers[numberOfOffers - 1].numberOfPayments
            );
        }
    }    

    // Debug output to display the privateOffers object
    console.log("Debug Output: _privateOffers", _privateOffers);
}

function AdjustEndDate(endDate, numberOfPayments) {

    let tmpEndDate = stringToDate(endDate);

    // Check if tmpEndDate is valid
    if (!(tmpEndDate instanceof Date) || isNaN(tmpEndDate)) {
        console.error("Invalid endDate provided:", endDate);
        return null; // Or a fallback date
    }

    const dayOfMonth = tmpEndDate.getDate(); // Store the original day of the month

    if (_paymentFrequency === 'Month') {
        for (let i = 1; i < numberOfPayments; i++) {
            tmpEndDate.setMonth(tmpEndDate.getMonth() + 1);

            // Handle month overflow (e.g., moving from Jan 31 to Feb)
            if (tmpEndDate.getDate() < dayOfMonth) {
                tmpEndDate.setDate(0); // Set to the last day of the previous month
            }
        }
    } else if (_paymentFrequency === 'Year') {
        for (let i = 1; i < numberOfPayments; i++) {
            tmpEndDate.setFullYear(tmpEndDate.getFullYear() + 1);

            // Handle year overflow (e.g., moving from Feb 29 in a leap year to Feb in a non-leap year)
            if (tmpEndDate.getDate() < dayOfMonth) {
                tmpEndDate.setDate(0); // Set to the last day of the previous month
            }
        }
    }

    return tmpEndDate;
}

function DisplayPrivateOffers() {
    let output = document.getElementById('output');
    output.innerHTML = ''; // Clear existing content

    _autoRenew = _privateOffers.length > 1;


    // Initialize the main accordion container
    let content = `
        <div class="accordion" id="accordionExample">
            <!-- Offer Prerequisites Section -->
            <div class="accordion-item">
                <h2 class="accordion-header" id="headingOne">
                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
                        <strong>Step One</strong> - Offer Prerequisites
                    </button>
                </h2>
                <div id="collapseOne" class="accordion-collapse collapse show" aria-labelledby="headingOne" data-bs-parent="#accordionExample">
                    <div class="accordion-body">
                        <p>A published offer with a public plan configured as follows:</p>
                        <ul>
                            <li><strong>Pricing model:</strong> ${_pricingModel}</li>
                            <li><strong>Billing Term:</strong> ${_billingTerm}</li>
                            <li><strong>Payment option:</strong> ${_paymentOption}</li>
                        </ul>
                        <p><strong>Note:</strong> This example assumes the customer will subscribe in ${_thisMonth} ${_thisYear}.</p>
                        <hr>
                        <!-- Related Documentation Section -->
                        <details class="mt-3">
                            <summary><strong>Related Documentation</strong></summary>
                            <ul class="mt-2">
                                <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/isv-customer#private-offer-prerequisites" target="_blank" rel="noopener noreferrer">Prerequisites</a></li>
                                <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer#plans" target="_blank" rel="noopener noreferrer">Plans</a></li>
                                <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer#saas-pricing-models" target="_blank" rel="noopener noreferrer">Pricing models</a></li>
                                <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer#saas-billing-terms-and-payment-options" target="_blank" rel="noopener noreferrer">Billing terms and payment options</a></li>
                            </ul>
                        </details>

                        <!-- Related Videos Section -->
                        <details class="mt-3">
                            <summary><strong>Related Mastering the Marketplace Videos</strong></summary>
                            <ul class="mt-2">
                                <li><a href="https://partner.microsoft.com/en-us/training/assets/detail/private-offers-overview-mp4" target="_blank" rel="noopener noreferrer">Private offer overviews</a></li>
                                <li><a href="https://partner.microsoft.com/en-us/training/assets/detail/handling-multiple-currencies-for-different-markets-mp4" target="_blank" rel="noopener noreferrer">Handling multiple currencies</a></li>
                            </ul>
                        </details>
                    </div>
                </div>
            </div>

            <!-- Private Offers Configuration Section -->
            <div class="accordion-item">
                <h2 class="accordion-header" id="headingTwo">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
                        <strong>Step two</strong> - Private Offer(s) Configuration
                    </button>
                </h2>
                <div id="collapseTwo" class="accordion-collapse collapse" aria-labelledby="headingTwo" data-bs-parent="#accordionExample">
                    <div class="accordion-body">
                    <p>To support the provided deal configuration, please create the following private offer(s) as outlined below:</p>
    `;

    // Iterate over private offers and add details
    _privateOffers.forEach((offer) => {
        content += `
                        <p><strong>Private Offer ${offer.id}</strong></p>
                        <li><strong>Start date:</strong> ${FormatDateToMMYYYY(offer.startDate)}</li>
                        <li><strong>End date:</strong> ${FormatDateToMMYYYY(offer.endDate)}</li>
                        <li><strong>Set the price per payment to:</strong> ${formatCurrency(offer.amount)}</li>
                        <li><strong>Billing term:</strong> ${_billingTerm}</li>
                        <li><strong>Payment option:</strong> ${_paymentOption}</li>
                        <p></p>
        `;
    });

    content += `
                        <hr>
                        <!-- Related Documentation Section -->
                        <details class="mt-3">
                            <summary><strong>Related Documentation</strong></summary>
                            <ul class="mt-2">
                                <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/isv-customer#create-a-private-offer-for-a-customer" target="_blank" rel="noopener noreferrer">Create a private offer</a></li>
                                <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/isv-customer-faq" target="_blank" rel="noopener noreferrer">Private offers FAQ</a></li>
                            </ul>
                        </details>

                        <!-- Related Videos Section -->
                        <details class="mt-3">
                            <summary><strong>Related Mastering the Marketplace Videos</strong></summary>
                            <ul class="mt-2">
                                <li><a href="https://partner.microsoft.com/en-us/training/assets/detail/creating-private-offers-for-customers-mp4" target="_blank" rel="noopener noreferrer">Creating a private offer</a></li>
                                <li><a href="https://partner.microsoft.com/en-us/training/assets/detail/handling-multiple-currencies-for-different-markets-mp4" target="_blank" rel="noopener noreferrer">Handling multiple currencies</a></li>
                            </ul>
                        </details>    
                        
                    </div>
                </div>
            </div>

            <!-- Customer Actions Section -->
            <div class="accordion-item">
                <h2 class="accordion-header" id="headingThree">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
                        <strong>Step three</strong> - Customer Action
                    </button>
                </h2>
                <div id="collapseThree" class="accordion-collapse collapse" aria-labelledby="headingThree" data-bs-parent="#accordionExample">
                    <div class="accordion-body">
                        <p><strong>ISV Action:</strong></p>
                        <li>Prepare and send an email to your customer, including the link(s) to the newly created private offer(s). </li>
                        <li>At the end of the <strong>${_numberOfPayments} ${_paymentFrequency}</strong>, you will need to set up a new private offer on the same public plan or customer will fall back to the list price.</li>
                        <p></p>
                        
                        <p><strong>Customer Action:</strong></p>
                        <p>You can use the following action list as supplemental information to include in your email when sharing the private offer link with your customer.</p>
                        <li>Accept the private offer(s) to lock the price for the <strong>${_numberOfPayments} ${_paymentFrequency}(s)</strong>.</li>
                        <li>Subscribe (purchase) the product and ensure that the <strong>${_billingTerm}</strong> term is selected.</li>
                        ${_autoRenew ? `
                        <li>Ensure to have the <strong>auto-renew is set to true</strong> (selected).</li>
                        <li>Alternatively, Customer should <strong>switch off auto-renew</strong> if they no longer want the product after the <strong>${_numberOfPayments} ${_paymentFrequency}(s)</strong>.</li>
                        <li>If <strong>auto-renew</strong> is enabled when the current subscription expires, the renewal will proceed at public pricing if no new or existing private offer is available.</li>
                        ` : ''}
            
                        <hr>
                        <!-- Related Documentation Section -->
                        <details class="mt-3">
                            <summary><strong>Related Documentation</strong></summary>
                            <ul class="mt-2">
                                <li><a href="https://learn.microsoft.com/en-us/marketplace/private-offers-overview" target="_blank" rel="noopener noreferrer">Customer private offers overview</a></li>
                                <li><a href="https://learn.microsoft.com/en-us/marketplace/private-offers-pre-check" target="_blank" rel="noopener noreferrer">Customer: Prepare your account</a></li>
                                <li><a href="https://learn.microsoft.com/en-us/marketplace/private-offers-accept-offer" target="_blank" rel="noopener noreferrer">Customer: Accept the offer</a></li>
                                <li><a href="https://learn.microsoft.com/en-us/marketplace/private-offers-purchase" target="_blank" rel="noopener noreferrer">Customer: Purchase or subscribe</a></li>
                            </ul>
                        </details>

                        <!-- Related Videos Section -->
                        <details class="mt-3">
                            <summary><strong>Related Mastering the Marketplace Videos</strong></summary>
                            <ul class="mt-2">
                                <li><a href="https://partner.microsoft.com/en-us/training/assets/detail/private-offers-overview-mp4" target="_blank" rel="noopener noreferrer">Private offers overview for customer</a></li>
                            </ul>
                        </details>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Set the constructed content to the output container
    output.innerHTML = content;
}

function FormatDateToMMYYYY(date) {

    let parsedDate = stringToDate(date);

    // Format to MM/YYYY
    const formattedMonth = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const formattedYear = parsedDate.getFullYear();

    return `${formattedMonth}/${formattedYear}`;
}

function DelayedBilling() {
    // Clear existing content
    let output = document.getElementById('output');
    output.innerHTML = '';

    // Create form for Delayed Billing details
    let formContent = `
        <div class="card">
            <div class="card-header">
                Delayed Billing
            </div>
            <div class="card-body">
                <h5 class="card-title">How to configure delayed billing</h5>
                <p class="card-text">Select the <strong>Variable amounts</strong> options and change the price to zero to one or more of the payments.</p>
            </div>
        </div>
    `;

    // Insert form content into the output element
    output.innerHTML = formContent;

}

function SinglePrivateOffer() {
    let output = document.getElementById('output');
    output.innerHTML = '';

    // Check payment frequency and set billing terms accordingly
    if (_paymentFrequency === 'Month') {
        if (_numberOfPayments === 1) {
            _billingTerm = "1-Month";
            _paymentOption = "One-time";
        } else if (_numberOfPayments < 12) {
            _billingTerm = "1-Month";
            _paymentOption = "One-time";
            _autoRenew = true;
        } else if (_numberOfPayments === 12) {
            _billingTerm = "1-Year";
            _paymentOption = "Per month";
        } else if (_numberOfPayments < 24) {
            _billingTerm = "1-Month";
            _paymentOption = "One-time";
            _autoRenew = true;
        }
    } else if (_paymentFrequency === 'Year' && _numberOfPayments === 1) {
        _billingTerm = "1-Year";
        _paymentOption = "One-time";
    }


    //_endDate = AdjustEndDate(new Date(_startDate));
    if (_paymentFrequency === 'Month') {
        _endDate.setMonth(_startDate.getMonth() + _numberOfPayments);
    } else if (_paymentFrequency === 'Year') {
        _endDate.setFullYear(_startDate.getFullYear() + _numberOfPayments);
    }

    // Clear the array to start fresh
    _privateOffers.length = 0;

    // Initialize the first private offer based on the first payment
    _privateOffers.push({
        id: 1,
        numberOfPayments: 1,
        startDate:  new Date(),
        endDate: _endDate,
        amount: _pricePerPayment,
    });

    DisplayPrivateOffers();

}
