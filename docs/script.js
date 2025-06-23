document.addEventListener("DOMContentLoaded", function () {

    // Initialize variables at the top to avoid TDZ errors
    let _thisMonth = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
    let _thisYear = new Date().getFullYear();
    let _pricePerPayment, _startDate = new Date(), _endDate = new Date();
    let _pricingModel = "Flat rate", _billingTerm = "N/A", _paymentOption = "N/A";
    let _autoRenew = false;
    let _contractTotal, _contractDuration, _contractInMonths, _numberOfPayments, _paymentFrequency, _variableAmounts = false, _singlePayment = false, _delayBilling = false;

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

    // Function to get months from contractDuration value
    function getMonthsFromContractDuration(value) {
        switch (value) {
            case "1-Month": return 1;
            case "1-Year": return 12;
            case "2-Years": return 24;
            case "3-Years": return 36;
            case "4-Years": return 48;
            case "5-Years": return 60;
            case "Over 5 years": return Infinity;
            case "Months with partial year": return null;
            default: return 0;
        }
    }

    // Function to add months to a date
    function addMonthsToDate(date, months) {
        if (!(date instanceof Date) || isNaN(date) || !isFinite(months)) {
            console.error("Invalid date or months:", date, months);
            return new Date();
        }
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        // Handle day overflow (e.g., March 31 + 1 month = April 30)
        if (result.getDate() !== date.getDate()) {
            result.setDate(0);
        }
        return result;
    }

    // Function to calculate number of payments
    function calculateNumberOfPayments(contractDuration, paymentFrequency) {
        const contractMonths = getMonthsFromContractDuration(contractDuration);
        let frequencyMonths;

        switch (paymentFrequency) {
            case "Month":
                frequencyMonths = 1;
                break;
            case "Year":
                frequencyMonths = 12;
                break;
            case "Flexible":
                return null;
            default:
                return 0;
        }

        if (contractMonths === null) {
            return null;
        }

        if (contractMonths === Infinity) {
            return Math.ceil(60 / frequencyMonths);
        }

        if (contractMonths === 0 || frequencyMonths == 0) {
            return 0;
        }

        return Math.ceil(contractMonths / frequencyMonths);
    }

    // DOM-safe initialization for dynamic elements
    const currencySymbol = document.querySelector('.currency-symbol');
    const contractDuration = document.getElementById("contractDuration");
    const numberOfPayments = document.getElementById("numberOfPayments");
    const configureButton = document.getElementById("cmdConfigure");
    const durationSelect = document.getElementById('contractDuration');

    if (currencySymbol) {
        currencySymbol.textContent = new Intl.NumberFormat('default', {
            style: 'currency',
            currency: 'USD'
        }).format(0).replace(/\d/g, '');
    }
    durationSelect.addEventListener('change', function () {
        const existing = document.getElementById('delayedBillingNote');
        if (existing) existing.remove();

        if (durationSelect.value === "Delayed-billing") {
            const infoBlock = document.createElement('div');
            infoBlock.id = 'delayedBillingNote';
            infoBlock.className = 'alert alert-info mt-4';
            infoBlock.innerHTML = `
                <p><strong>To configure delayed billing:</strong></p>
                <p>Select a contract duration of one year or longer, and set the Payment frequency to Flexible schedule. In the Number of payments field, enter one more than the expected number of payments — the first payment will be configured as $0 to create the delay.</p>
                <p><strong>Example:</strong><br>
                If the intended contract is for 2 years with 2 payments, select 3 payments. Payment 1 will be $0, and Payments 2 and 3 will follow the expected schedule.</p>
            `;
            const form = document.getElementById('privateOfferForm');
            form.appendChild(infoBlock);
        }
    });

    if (contractDuration && numberOfPayments) {
        const paymentFrequency = document.getElementById("paymentFrequency");
        const numberOfPaymentsGroup = document.getElementById("numberOfPaymentsGroup");

        // Set default paymentFrequency to "Month" on page load
        if (paymentFrequency) {
            paymentFrequency.value = "Month";
        }

        function updatePaymentsState() {
            if (!paymentFrequency) return;
            if (contractDuration.value === "1-Month") {
                numberOfPayments.value = 1;
                numberOfPayments.readOnly = true;
                numberOfPayments.classList.add("bg-light");
                paymentFrequency.value = "Month";
                paymentFrequency.disabled = true;
            } else {
                numberOfPayments.readOnly = false;
                numberOfPayments.classList.remove("bg-light");
                paymentFrequency.disabled = false;
                // Update numberOfPayments based on current inputs
                const calculatedPayments = calculateNumberOfPayments(contractDuration.value, paymentFrequency.value);
                if (calculatedPayments !== null) {
                    numberOfPayments.value = calculatedPayments;
                }
            }
        }

        function toggleNumberOfPaymentsVisibility() {
            if (!paymentFrequency || !numberOfPaymentsGroup) return;
            if (paymentFrequency.value === "Flexible") {
                numberOfPaymentsGroup.style.display = "block";
                _variableAmounts = true;
            } else {
                numberOfPaymentsGroup.style.display = "none";
                _variableAmounts = false;
            }
        }

        const input = document.getElementById("contractTotal");

        input.addEventListener("blur", function () {
            const raw = input.value.replace(/[^\d]/g, "");
            if (raw) {
                const number = parseInt(raw, 10);
                if (!isNaN(number)) {
                    input.value = number.toLocaleString("en-US");
                }
            } else {
                input.value = "";
            }
        });

        input.addEventListener("focus", function () {
            input.value = input.value.replace(/[^\d]/g, "");
        });


        // Enforce 1-70 constraint on numberOfPayments when losing focus
        numberOfPayments.addEventListener("blur", function () {
            let value = parseInt(numberOfPayments.value);
            if (isNaN(value) || value <= 0) {
                numberOfPayments.value = 1;
            } else if (value > 70) {
                numberOfPayments.value = 70;
            }
        });

        contractDuration.addEventListener("change", updatePaymentsState);
        if (paymentFrequency) {
            paymentFrequency.addEventListener("change", updatePaymentsState);
            paymentFrequency.addEventListener("change", toggleNumberOfPaymentsVisibility);
        }
        updatePaymentsState();
        toggleNumberOfPaymentsVisibility();
    }

    if (configureButton) {
        let isConfigured = false;

        configureButton.addEventListener('click', function () {
            if (isConfigured) {
                resetForm();
                configureButton.textContent = 'Configure Offer';
                isConfigured = false;
            } else {
                SelectScenario();
                configureButton.textContent = 'Reset Configuration';
                isConfigured = true;
            }
        });
    }

    function resetForm() {
        const contractTotalInput = document.getElementById('contractTotal');
        const contractTotalValue = contractTotalInput ? contractTotalInput.value : '';

        document.getElementById('privateOfferForm').reset();

        if (contractTotalInput) {
            contractTotalInput.value = contractTotalValue;
        }

        const advancedOptions = document.getElementById('advancedOptions');
        if (advancedOptions) {
            advancedOptions.classList.add('d-none');
        }

        const numberOfPaymentsGroup = document.getElementById('numberOfPaymentsGroup');
        if (numberOfPaymentsGroup) {
            numberOfPaymentsGroup.style.display = 'none';
        }

        const paymentFrequency = document.getElementById('paymentFrequency');
        if (paymentFrequency) {
            paymentFrequency.value = "Month";
            paymentFrequency.disabled = true;
        }

        document.getElementById('output').innerHTML = '';

        _numberOfPayments = 0;
        _paymentFrequency = '';
        _variableAmounts = false;
        _singlePayment = false;
        _delayBilling = false;
        _pricePerPayment = 0;
        _privateOffers.length = 0;
        _payments.length = 0;

        // Re-run updatePaymentsState to set default numberOfPayments
        updatePaymentsState();
    }

    let checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', function () {
            checkboxes.forEach((box) => {
                if (box !== checkbox) box.checked = false;
            });
        });
    });

    function formatCurrency(amount) {
        return new Intl.NumberFormat('default', { style: 'currency', currency: 'USD' }).format(amount);
    }

    function formatNumber(number) {
        return new Intl.NumberFormat('default', { maximumFractionDigits: 2 }).format(number);
    }

    function detectLocaleDateOrder() {
        const sampleDate = new Date(2024, 10, 5);
        const formattedDate = sampleDate.toLocaleDateString();

        if (formattedDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const [part1, part2] = formattedDate.split('/');
            return part1 === "11" ? "MM/dd/yyyy" : "dd/MM/yyyy";
        } else if (formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return "yyyy-MM-dd";
        }

        console.warn("Unknown date format, defaulting to MM/dd/yyyy");
        return "MM/dd/yyyy";
    }

    function stringToDate(input) {
        if (input instanceof Date) {
            return input;
        }

        // Attempt to parse YYYY-MM-DD first, as this is the standard for <input type="date">
        const yyyyMmDdMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (yyyyMmDdMatch) {
            const year = parseInt(yyyyMmDdMatch[1]);
            const month = parseInt(yyyyMmDdMatch[2]) - 1; // Month is 0-indexed
            const day = parseInt(yyyyMmDdMatch[3]);
            return new Date(year, month, day);
        }

        // Fallback to locale detection for other formats (like MM/DD/YYYY or DD/MM/YYYY)
        if (typeof input !== 'string') {
            console.error("Expected a string for date input, but received:", input);
            return null;
        }

        const format = detectLocaleDateOrder();
        const parts = input.split(/[-/]/).map(Number);
        const today = new Date();
        const currentDay = today.getDate();

        if (parts.length === 3) { // This part is for MM/DD/YYYY or DD/MM/YYYY
            if (format === "dd/MM/yyyy") {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            } else if (format === "MM/dd/yyyy") {
                return new Date(parts[2], parts[0] - 1, parts[1]);
            } else if (format === "yyyy-MM-dd") {
                return new Date(parts[0], parts[1] - 1, parts[2]);
            }
        }

        if (parts.length === 2 && parts[0] <= 12 && parts[1] >= 1000) { // For MM/YYYY
            return new Date(parts[1], parts[0] - 1, currentDay);
        }

        console.error("Unsupported or invalid date format:", input);
        return null;
    }

    function SelectScenario() {
        _contractTotal = parseFloat(document.getElementById('contractTotal').value.replace(/[^0-9.]/g, ""));
        if (isNaN(_contractTotal)) {
            alert("Invalid contract total");
            return;
        }
        _paymentFrequency = document.getElementById('paymentFrequency').value;

        //TODO: Refactor -hugos
        _contractInMonths = getMonthsFromContractDuration(contractDuration.value);
        _contractDuration = contractDuration.value; 
        _paymentOption = (_contractInMonths === 1) ? "One-time" : _paymentFrequency;
        _endDate = addMonthsToDate(_startDate, _contractInMonths);
        // End TODO: Refactor

        // Calculate number of payments
        const calculatedPayments = calculateNumberOfPayments(contractDuration.value, _paymentFrequency);
        const numberOfPaymentsInput = document.getElementById('numberOfPayments');
        let inputPayments = parseInt(numberOfPaymentsInput.value) || 1;

        if (_paymentFrequency === "Flexible") {
            _numberOfPayments = Math.max(1, Math.min(70, inputPayments));
        } else if (calculatedPayments !== null) {
            _numberOfPayments = Math.max(1, Math.min(70, calculatedPayments));
        } else {
            _numberOfPayments = Math.max(1, Math.min(70, inputPayments));
        }

        _billingTerm = _paymentFrequency;
        _paymentOption = "One-time";
        _pricePerPayment = _contractTotal / _numberOfPayments;
        _contractDuration = contractDuration.value;
        
        if (_variableAmounts) {
            console.log('VariableAmounts:');
            VariableAmounts();
        } else {
            console.log('Standard:');
            SinglePrivateOffer();
        }
    }

    function SinglePayment() {
        document.getElementById('numberOfPayments').value = 1;
        document.getElementById('paymentFrequency').value = 'Month';

        _numberOfPayments = 1;
        _paymentFrequency = 'Month';
        _billingTerm = "Month";
        _contractTotal = parseFloat(document.getElementById('contractTotal').value.replace(/[^0-9.]/g, ""));
        if (isNaN(_contractTotal)) {
            alert("Invalid contract total");
            return;
        }

        const today = new Date();
        const currentMonthYear = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

        let output = document.getElementById('output');
        output.innerHTML = '';

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

        output.innerHTML = formContent;

        document.getElementById('submitSinglePayment').addEventListener('click', () => {
            const subscriptionEndDate = document.getElementById('subscriptionEndDate').value;

            const datePattern = /^(0[1-9]|1[0-2])\/(\d{4})$/;
            const match = subscriptionEndDate.match(datePattern);
            if (!match) {
                alert('Please enter a valid date in MM/YYYY format.');
                return;
            }

            const month = parseInt(match[1]);
            const year = parseInt(match[2]);
            const currentYear = today.getFullYear();

            if (year < currentYear) {
                alert('The year must be equal to or greater than the current year.');
                return;
            }

            SaveSinglePayment();
        });
    }

    function SaveSinglePayment() {
        const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
        const paymentDate = document.getElementById('paymentDate').value;
        const subscriptionEndDate = document.getElementById('subscriptionEndDate').value;

        if (!paymentAmount || !paymentDate || !subscriptionEndDate) {
            alert('Please fill out all fields correctly.');
            return;
        }

        let [month, year] = subscriptionEndDate.split("/");

        _privateOffers.length = 0;

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
            startDate: startDate,
            endDate: new Date(year, month - 1, 1),
            amount: 0,
        });

        console.log('Payment Amount:', paymentAmount);
        console.log('Payment Date:', paymentDate);
        console.log('Start Date:', startDate);
        console.log('Subscription End Date:', subscriptionEndDate);

        DisplayPrivateOffers();
    }

    function VariableAmounts() {
        const output = document.getElementById('output');
        output.innerHTML = '';

        const initialInvoiceDate = new Date();
        let i = 1;
        _payments.length = 0;

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
            let tmpInvoiceDate = new Date(initialInvoiceDate);
            const increment = i - 1;

            if (_paymentFrequency === 'Month' || _paymentFrequency === 'Flexible') {
                tmpInvoiceDate.setMonth(tmpInvoiceDate.getMonth() + increment);
                if (tmpInvoiceDate.getDate() !== initialInvoiceDate.getDate()) {
                    tmpInvoiceDate.setDate(0);
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
                        <input type="date" id="date-${i}" value="${tmpInvoiceDate.toISOString().split('T')[0]}" class="form-control date-input">
                    </div>
                </div>
            `;

            _payments.push({
                id: i,
                amount: _pricePerPayment,
                dueDate: tmpInvoiceDate.toISOString().split('T')[0] // Store in yyyy-MM-dd for input type="date"
            });
        }

        output.innerHTML += `</div>`;

        const saveButton = document.createElement('button');
        saveButton.textContent = 'View Private Offers configuration';
        saveButton.className = 'btn btn-success mt-3';
        saveButton.disabled = true;
        saveButton.addEventListener('click', SavePayment);
        output.appendChild(saveButton);

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

        document.querySelectorAll('.payment-input').forEach(input => {
            input.addEventListener('input', updateDealValues);
        });

        document.querySelectorAll('.date-input').forEach(input => {
            input.addEventListener('change', function() {
                const index = parseInt(this.id.split('-')[1]) - 1;
                _payments[index].dueDate = this.value; // Update the dueDate in _payments array
            });
        });

        updateDealValues();

        function updateDealValues() {
            let totalPayments = Array.from(document.querySelectorAll('.payment-input')).reduce((sum, input) => {
                return sum + parseFloat(input.value || 0);
            }, 0);

            let amountNeeded = _contractTotal - totalPayments;

            document.getElementById('totalPaymentsAmount').textContent = formatCurrency(totalPayments);
            document.getElementById('amountNeeded').textContent = formatCurrency(amountNeeded);

            saveButton.disabled = amountNeeded !== 0;
        }
    }

    function SavePayment() {
        let tmpTotal = 0;

        _payments.forEach((payment, index) => {
            const amountInput = parseFloat(document.getElementById(`payment-${index + 1}`).value.replace('$', ''));
            payment.amount = amountInput;
            tmpTotal += amountInput;
        });

        if (tmpTotal !== _contractTotal) {
            alert("The deal total does not match the sum of all payments: $" + tmpTotal.toFixed(2) + " vs $" + _contractTotal.toFixed(2) + ", please review the payment amounts and update as appropriate.");
        } else {
            CalculatePrivateOffers();
            DisplayPrivateOffers();
        }
    }

    function CalculatePrivateOffers() {
        let numberOfOffers = 1;
        _privateOffers.length = 0;

        for (let index = 0; index < _payments.length; index++) {
            const payment = _payments[index];
            _privateOffers.push({
                id: numberOfOffers++,
                numberOfPayments: 1,
                startDate: stringToDate(payment.dueDate),
                endDate: _endDate,
                amount: payment.amount,
            });
            break;
        }
    }

    function AdjustEndDate(endDate, numberOfPayments) {
        let tmpEndDate = stringToDate(endDate);

        if (!(tmpEndDate instanceof Date) || isNaN(tmpEndDate)) {
            console.error("Invalid endDate provided:", endDate);
            return null;
        }

        const dayOfMonth = tmpEndDate.getDate();

        if (_paymentFrequency === 'Month') {
            for (let i = 1; i < numberOfPayments; i++) {
                tmpEndDate.setMonth(tmpEndDate.getMonth() + 1);
                if (tmpEndDate.getDate() < dayOfMonth) {
                    tmpEndDate.setDate(0);
                }
            }
        } else if (_paymentFrequency === 'Year') {
            for (let i = 1; i < numberOfPayments; i++) {
                tmpEndDate.setFullYear(tmpEndDate.getFullYear() + 1);
                if (tmpEndDate.getDate() < dayOfMonth) {
                    tmpEndDate.setDate(0);
                }
            }
        }

        return tmpEndDate;
    }

    function DisplayPrivateOffers() {
        let output = document.getElementById('output');
        output.innerHTML = '';

        _autoRenew = _privateOffers.length > 1;

        let content = `
            <div class="accordion" id="accordionExample">
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
                                <li><strong>Contract duration:</strong> ${_contractDuration}</li>
                                <li><strong>Billing frequency:</strong> ${_billingTerm}</li>
                            </ul>
                            <p><strong>Note:</strong> This example assumes the customer will subscribe in ${_thisMonth} ${_thisYear}.</p>
                            <hr>
                            <details class="mt-3">
                                <summary><strong>Related Documentation</strong></summary>
                                <ul class="mt-2">
                                    <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/isv-customer#private-offer-prerequisites" target="_blank" rel="noopener noreferrer">Prerequisites</a></li>
                                    <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer#plans" target="_blank" rel="noopener noreferrer">Plans</a></li>
                                    <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer#saas-pricing-models" target="_blank" rel="noopener noreferrer">Pricing models</a></li>
                                    <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer#saas-billing-terms-and-payment-options" target="_blank" rel="noopener noreferrer">Billing terms and payment options</a></li>
                                </ul>
                            </details>
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
                <div class="accordion-item">
                    <h2 class="accordion-header" id="headingTwo">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
                            <strong>Step two</strong> - Private Offer(s) Configuration
                        </button>
                    </h2>
                    <div id="collapseTwo" class="accordion-collapse collapse" aria-labelledby="headingTwo" data-bs-parent="#accordionExample">
                        <div class="accordion-body">
                            <p>To support the provided deal configuration, please create the following private offer(s) as outlined below:</p>
                            ${_variableAmounts ? `
                            <p>When creating a private offer in Partner Center, you’ll see three options under Flexible billing. Please select “Customize SaaS plans and Professional Services” as shown below:</p>
                            <p><strong>Steps:</strong></p>
                            <ol>
                            <li>Sign in to Partner Center.</li>
                            <li>Navigate to Marketplace offers > Private offers tab.</li>
                            <li>Click New private offer.</li>
                            <li>Choose Customize SaaS plans and Professional Services.</li>
                            <li>After selecting a plan and configuring the pricing, you’ll be able to schedule payments using the Flexible billing feature.</li>
                            </ol> 
                            ` : ""}
        `;

        _privateOffers.forEach((offer) => {
            content += `
                <p><strong>Private Offer ${offer.id}</strong></p>
                <ul>
                    <li><strong>Start date:</strong> ${FormatDateToMMYYYY(offer.startDate)}</li>
                    <li><strong>End date:</strong> ${FormatDateToMMYYYY(_endDate)}</li>
            `;

            if (_paymentFrequency === "Flexible") {
                content += `
                    <li><strong>Contract duration:</strong> ${_contractDuration}</li>
                    <li><strong>Billing frequency:</strong> ${_billingTerm}</li>
                    <li><strong>Pricing:</strong></li>
                `;
                _payments.forEach((payment) => {
                    content += `<li><strong>Amount:</strong> ${formatCurrency(payment.amount)} <strong>Charge date:</strong> ${FormatDateToLocale(payment.dueDate)}</li>`;
                });
                content += `</ul><p></p>`;
            } else {
                content += `
                    <li><strong>Set the price per payment to:</strong> ${formatCurrency(offer.amount)}</li>
                    <li><strong>Billing term:</strong> ${_billingTerm}</li>
                    <li><strong>Payment option:</strong> ${_paymentOption}</li>
                </ul><p></p>`;
            }
        });

        content += `
                            <hr>
                            <details class="mt-3">
                                <summary><strong>Related Documentation</strong></summary>
                                <ul class="mt-2">
                                    <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/isv-customer#create-a-private-offer-for-a-customer" target="_blank" rel="noopener noreferrer">Create a private offer</a></li>
                                    <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/isv-customer-faq" target="_blank" rel="noopener noreferrer">Private offers FAQ</a></li>
                                    ${_variableAmounts ? `
                                       <li><a href="https://learn.microsoft.com/en-us/partner-center/marketplace-offers/flexible-billing-schedule" target="_blank" rel="noopener noreferrer">Flexible billing</a></li>
                                    ` : ""}
                                </ul>
                            </details>
                            <details class="mt-3">
                                <summary><strong>Related Mastering the Marketplace Videos</strong></summary>
                                <ul class="mt-2">
                                    <li><a href="https://partner.microsoft.com/en-us/training/assets/detail/creating-private-offers-for-customers-mp4" target="_blank" rel="noopener noreferrer">Creating a private offer</a></li>
                                    <li><a href="https://partner.microsoft.com/en-us/training/assets/detail/handling-multiple-currencies-for-different-markets-mp4" target="_blank" rel="noopener noreferrer">Handling multiple currencies</a></li>
                                    ${_variableAmounts ? `
                                       <li><a href="https://microsoft.github.io/Mastering-the-Marketplace/partner-center/pc-flex-billing/" target="_blank" rel="noopener noreferrer">Flexible billing videos</a></li>
                                    ` : ""}
                                </ul>
                            </details>
                        </div>
                    </div>
                </div>
                <div class="accordion-item">
                    <h2 class="accordion-header" id="headingThree">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
                            <strong>Step three</strong> - Customer Action
                        </button>
                    </h2>
                    <div id="collapseThree" class="accordion-collapse collapse" aria-labelledby="headingThree" data-bs-parent="#accordionExample">
                        <div class="accordion-body">
                            <p><strong>ISV Action:</strong></p>
                            <ul>
                                <li>Prepare and send an email to your customer, including the link(s) to the newly created private offer(s).</li>
                                <li>At the end of the <strong>${_numberOfPayments} ${_paymentFrequency}</strong>, you will need to set up a new private offer on the same public plan or customer will fall back to the list price.</li>
                            </ul>
                            <p><strong>Customer Action:</strong></p>
                            <p>You can use the following action list as supplemental information to include in your email when sharing the private offer link with your customer.</p>
                            <ul>
                                <li><strong>Method:</strong> Accept the private offer(s) to lock the price for each of the <strong>${_numberOfPayments} ${_paymentFrequency}(s)</strong>.</li>
                                <li><strong>Method:</strong> Subscribe (purchase) the product and ensure that the <strong>${_billingTerm}</strong> term is selected.</li>
                                ${_autoRenew ? `
                                <li><strong>Method:</strong> Ensure that you have the <strong>auto-renewal enabled</strong> setting selected.</li>
                                <li><strong>Method:</strong> Alternatively, you should <strong>disable auto-renewal</strong> if you no longer want the product after the <strong>${_numberOfPayments} ${_paymentFrequency}(s)</strong>.</li>
                                <li><strong>Method:</strong> If <strong>auto-renewal</strong> is enabled when the current subscription expires, the renewal will proceed at public pricing if no new or existing private offer is available.</li>
                                ` : ''}
                            </ul>
                            <hr>
                            <details class="mt-3">
                                <summary><strong>Related Documentation</strong></summary>
                                <ul class="mt-2">
                                    <li><a href="https://learn.microsoft.com/en-us/marketplace/private-offers-overview" target="_blank" rel="noopener noreferrer">Customer private offers</a></li>
                                    <li><a href="https://learn.microsoft.com/en-us/marketplace/private-offers-pre-check" target="_blank" rel="noopener noreferrer">Customer: Prepare your account</a></li>
                                    <li><a href="https://learn.microsoft.com/en-us/marketplace/private-offers-accept" target="_blank" rel="noopener noreferrer">Customer Action: Accept the offer</a></li>
                                    <li><a href="https://learn.microsoft.com/en-us/marketplace/private-offers-purchase" target="_blank" rel="noopener noreferrer">Customer: Purchase or subscribe</a></li>
                                </ul>
                            </details>
                            <details class="mt-3">
                                <summary><strong>Related Mastering the Marketplace Videos</strong></summary>
                                <ul class="mt-2">
                                    <li><a href="https://partner.microsoft.com/en-us/training/assets/detail/private-offers-overview" target="_blank" rel="noopener noreferrer">Private Offerings Overview</a></li>
                                </ul>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
        `;

        output.innerHTML = content;
    }

    function FormatDateToMMYYYY(date) {
        let parsedDate = stringToDate(date);
        if (!parsedDate) return "Invalid Date";

        const formattedMonth = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const formattedYear = parsedDate.getFullYear();

        return `${formattedMonth}/${formattedYear}`;
    }

    function FormatDateToLocale(date) {
        let parsedDate = stringToDate(date);
        if (!parsedDate) return "Invalid Date";
        // Use toLocaleDateString without options to get the default locale format (MM/DD/YYYY or DD/MM/YYYY)
        // If you specifically need MM/DD/YYYY always, you can use:
        // return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(parsedDate);
        return parsedDate.toLocaleDateString();
    }

    function DelayedBilling() {
        let output = document.getElementById('output');
        output.innerHTML = '';

        let formContent = `
            <div class="card">
                <div class="card-header">
                    Delayed Billing
                </div>
                <div class="card-body">
                    <h5 class="card-title">How to configure delayed billing</h5>
                    <p class="card-text">Select the <strong>Variable amounts</strong> option and change the price to zero for one or more payment(s).</p>
                </div>
            </div>
        `;

        output.innerHTML = formContent;
    }

    function SinglePrivateOffer() {
        let output = document.getElementById('output');
        if (!output) {
            console.error("Output element not found");
            return;
        }
        output.innerHTML = '';

        if (!contractDuration) {
            console.error("Contract duration element not found");
            alert("Configuration error: Please ensure that the form is properly loaded.");
            return;
        }

        const validDurations = ["1-Month", "1-Year", "2-Years", "3-Years", "4-Years", "5-Years", "Over 5 years", "Months with partial year"];
        if (!validDurations.includes(contractDuration.value)) {
            console.error("Invalid contract duration:", contractDuration.value);
            alert("Please select a valid contract duration.");
            return;
        }

        // Compute contract duration in months
        const contractInMonths = getMonthsFromContractDuration(contractDuration.value);

        // Set billing term to contract duration value
        _contractDuration = contractDuration.value;

        // Set payment option based on contract duration
        _paymentOption = (contractInMonths === 1) ? "One-time" : _paymentFrequency;

        // Set end date
        _endDate = new Date(_startDate);
        if (isFinite(contractInMonths) && contractInMonths !== null && contractInMonths > 0) {
            _endDate = addMonthsToDate(_startDate, contractInMonths);
        } else if (contractInMonths === Infinity) {
            _endDate.setFullYear(_startDate.getFullYear() + 5);
        } else if (contractInMonths === null) {
            _endDate = addMonthsToDate(_startDate, _numberOfPayments);
        }

        _privateOffers.length = 0;

        _privateOffers.push({
            id: 1,
            numberOfPayments: _numberOfPayments,
            startDate: new Date(_startDate),
            endDate: _endDate,
            amount: _pricePerPayment,
        });

        DisplayPrivateOffers();
    }
});