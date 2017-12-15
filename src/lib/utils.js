export const filterParams = (perPage, params) => {
  let page = params.page || 1
  params.page = page
  let limit = params.limit || perPage
  limit = limit <= perPage ? limit : perPage
  params.limit = limit
  return params
}