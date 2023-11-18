$(document).ready(function () {
  console.log("new.js");
  $("#search_book").select2({
    theme: "bootstrap-5",
    ajax: {
      url: "https://www.googleapis.com/books/v1/volumes",
      dataType: "json",
      delay: 250,
      data: function (params) {
        return {
          q: params.term, // search term
          maxResults: 10, // adjust this as needed
        };
      },
      processResults: function (data, params) {
        params.page = params.page || 1;

        // Format the results to match the structure expected by Select2
        const results = data.items.map((item) => {
          const r = {
            id: item.id,
            text: item.volumeInfo.title,
            thumbnail: item.volumeInfo.imageLinks
              ? item.volumeInfo.imageLinks.smallThumbnail
              : null,
          };
          return r;
        });

        return {
          results: results,
          pagination: {
            more: params.page * 10 < data.totalItems,
          },
        };
      },
      // cache: true,
    },
    placeholder: "Search for a book",
    minimumInputLength: 1,
    templateResult: formatBook,
    templateSelection: formatBookSelection,
  });

  function formatBook(book) {
    if (!book.id) {
      return book.text;
    }

    const $container = $(`
    <div class='select2-result-repository clearfix'>
      <div class='select2-result-repository__avatar'><img src='${book.thumbnail}' /></div>
      <div class='select2-result-repository__meta'>
        <div class='select2-result-repository__title'>${book.text}</div>
      </div>
    </div>
  `);
    return $container;
  }

  function formatBookSelection(book) {
    return book.text || "Select a book";
  }
});
