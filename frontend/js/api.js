const API_BASE_URL = "http://127.0.0.1:8000";

async function uploadResult(file) {

    const formData = new FormData();

    formData.append("file", file);

    const response = await fetch(
        `${API_BASE_URL}/api/results/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    if (!response.ok) {

        let message = "PDF upload failed.";

        try {
            const errorData = await response.json();

            if (errorData.detail) {
                message = errorData.detail;
            }

        } catch (error) {
            // Ignore response parsing error
        }

        throw new Error(message);
    }

    return await response.json();
}


async function parseResult() {

    const response = await fetch(
        `${API_BASE_URL}/api/results/parse`
    );

    if (!response.ok) {

        let message = "Result parsing failed.";

        try {
            const errorData = await response.json();

            if (errorData.detail) {
                message = errorData.detail;
            }

        } catch (error) {
            // Ignore response parsing error
        }

        throw new Error(message);
    }

    return await response.json();
}


document
    .getElementById("uploadBtn")
    .addEventListener("click", async () => {

        const fileInput =
            document.getElementById("pdfFile");

        const status =
            document.getElementById("status");

        const uploadButton =
            document.getElementById("uploadBtn");

        const file = fileInput.files[0];


        if (!file) {

            status.textContent =
                "Please select a PDF file.";

            return;
        }


        if (file.type !== "application/pdf") {

            status.textContent =
                "Please select a valid PDF file.";

            return;
        }


        try {

            uploadButton.disabled = true;

            uploadButton.textContent =
                "Uploading...";


            status.textContent =
                "Uploading PDF...";


            await uploadResult(file);


            status.textContent =
                "PDF uploaded. Analyzing result...";


            uploadButton.textContent =
                "Analyzing...";


            const data =
                await parseResult();


            if (
                !data ||
                !Array.isArray(data.students)
            ) {

                throw new Error(
                    "No student data was found in the PDF."
                );
            }


            // Remove old result data

            sessionStorage.removeItem(
                "resultData"
            );


            // Store new result data

            sessionStorage.setItem(
                "resultData",
                JSON.stringify(data)
            );


            status.textContent =
                `Analysis complete. ${data.total_students} students found.`;


            uploadButton.textContent =
                "Opening Dashboard...";


            setTimeout(() => {

                window.location.href =
                    "dashboard.html";

            }, 500);


        } catch (error) {

            console.error(
                "Upload/Analysis Error:",
                error
            );


            status.textContent =
                error.message ||
                "Something went wrong.";


            uploadButton.disabled = false;

            uploadButton.textContent =
                "Upload & Analyze";
        }

    });