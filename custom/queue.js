const rowTemplate = document.querySelector('#result-row-template');

$("#reset").click(function () {
    $("#output").addClass('hide');
    $("#service_input").val('');
    $("#arrival_input").val('');
    $("#goal_service").val('');

});

$("#simulate").click(function () {
    if (($("#service_input").val() != "") && ($("#arrival_input").val() != "") && ($("#goal_service").val() != "")) {
        $('#results-tbody').empty();

        // There are inputs
        const service_input = $("#service_input").val();
        const arrival_input = $("#arrival_input").val();
        const goal_service = $("#goal_service").val();
        const lambda = (arrival_input / 60);
        const mu = 1 / service_input;

        $("#arrival_display").text(arrival_input);
        $("#service_display").text(service_input);
        let suggestion = 0;

        for (var c = 1; c <= 8; c++) {

            // Utilization
            let rho = lambda / c / mu;

            // Customers in queue
            let pNaught = 0;

            // Summation term
            for (n = 0; n < c; n++) {
                pNaught = pNaught + Math.pow((lambda / mu), n) / factorial(n);
            }

            // Add second term
            pNaught = pNaught + Math.pow((lambda / mu), c) * (1 / factorial(c)) * (c * mu / (c * mu - lambda));

            // Final inverse
            pNaught = 1 / pNaught;

            // Probability L of infinity is greater than c
            pLInfinity = Math.pow(c * rho, c) * pNaught / (factorial(c) * (1 - rho));

            // Now we calculate L
            // Init
            let l = c * rho;
            l = l + Math.pow(c * rho, (c + 1)) * pNaught / (c * factorial(c) * Math.pow(1 - rho, 2));
            l = l + rho * pLInfinity / (1 - rho);

            let w = l / lambda;

            let wQueue = w - 1 / mu;

            // number in line
            let lQueue = lambda * wQueue;

            // Create a new row
            const clone = $(rowTemplate.content.cloneNode(true));

            // Now display all those numbers
            clone.find('.count').text(c);
            clone.find('.modal-label').text(`Data for ${c} servers`);

            if (rho >= 1) {
                clone.find('tr').addClass('error');
                clone.find('.modal-body').text("Customers arrive faster than they may be served, so statistics are unavailable. The line is always growing.");
            } else {
                clone.find('.terminal-utilisation').html(Math.round(rho * 100) + "%");
                clone.find('.queue-length').text((Math.round(lQueue * 100) / 100).toFixed(2));

                min = Math.floor(w);
                sec = Math.floor(w % 1 * 60);

                clone.find('.modal-body').html(`
                    <dl>
                        <dt>Servers:</dt><dd>${c}</dd>
                        <dt>Arrival rate:</dt><dd>${lambda}</dd>
                        <dt>Service Rate of one server:</dt><dd>${mu}</dd>
                        <dt>Server utilization:</dt><dd>${rho}</dd>
                        <dt>Steady-state probability of zero customers in system:</dt><dd>${pNaught}</dd>
                        <dt>Avg time in system per customer:</dt><dd>${w}</dd>
                        <dt>Avg time in queue per customer:</dt><dd>${wQueue}</dd>
                        <dt>Avg number of customers in system:</dt><dd>${l}</dd>
                        <dt>Avg number of customers in line:</dt><dd>${lQueue}</dd>
                    </dl>
                `);
                clone.find('.checkout-time').text(`${min}:${sec.toString().padStart(2, '0')}`);

                if (w > goal_service) {
                    clone.find('tr').addClass('warning');
                }
                else {
                    clone.find('tr').addClass('success');
                    if (suggestion == 0) {
                        suggestion = c;
                    }
                }
            }

            // Attach the data modal trigger
            clone.find('.data-modal').attr('id', `data-modal-${c}`);
            clone.find('.data-modal-trigger').attr('href', `#data-modal-${c}`);

            $('#results-tbody').append(clone);
        }

        // Now we print the suggestion
        if (suggestion == 0) {
            $("#rec_outer").addClass('hidden');

        } else {
            $("#rec_outer").removeClass('hidden');
            $("#recommendation").text(suggestion);
        }

        $("#output").removeClass('hide');
    }
});

function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}